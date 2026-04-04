param(
  [ValidateSet('snapshot', 'control')]
  [string]$Action = 'snapshot',

  [ValidateSet('play', 'pause', 'toggle', 'next', 'previous')]
  [string]$Control = 'toggle'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction Stop

$script:ManagerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
$script:MediaPropsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
$script:RandomAccessStreamType = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType=WindowsRuntime]
$script:DataReaderType = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime]
$script:AsTaskGenericMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' `
    -and $_.IsGenericMethodDefinition `
    -and $_.GetParameters().Count -eq 1 `
    -and $_.GetGenericArguments().Count -eq 1
} | Select-Object -First 1

function Convert-WinRtAsync {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Operation,

    [Parameter(Mandatory = $true)]
    [Type]$ResultType
  )

  $task = $script:AsTaskGenericMethod.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  return $task.GetAwaiter().GetResult()
}

function Close-IfPossible {
  param([object]$Value)

  if ($null -eq $Value) {
    return
  }

  $disposeMethod = $Value.GetType().GetMethod('Dispose', [Type[]]@())
  if ($disposeMethod) {
    [void]$disposeMethod.Invoke($Value, @())
    return
  }

  $closeMethod = $Value.GetType().GetMethod('Close', [Type[]]@())
  if ($closeMethod) {
    [void]$closeMethod.Invoke($Value, @())
  }
}

function Get-MediaSession {
  $manager = Convert-WinRtAsync -Operation ($script:ManagerType::RequestAsync()) -ResultType $script:ManagerType
  if ($null -eq $manager) {
    return $null
  }

  return $manager.GetCurrentSession()
}

function Get-ThumbnailDataUrl {
  param([object]$Thumbnail)

  if ($null -eq $Thumbnail) {
    return ''
  }

  $stream = $null
  $reader = $null

  try {
    $stream = Convert-WinRtAsync -Operation ($Thumbnail.OpenReadAsync()) -ResultType $script:RandomAccessStreamType
    if ($null -eq $stream) {
      return ''
    }

    $size = [uint32][Math]::Min([int64]$stream.Size, 2MB)
    if ($size -le 0) {
      return ''
    }

    $reader = [Activator]::CreateInstance($script:DataReaderType, @($stream))
    [void](Convert-WinRtAsync -Operation ($reader.LoadAsync($size)) -ResultType ([uint32]))

    $bytes = New-Object byte[] ([int]$size)
    $reader.ReadBytes($bytes)

    $contentType = [string]$stream.ContentType
    if (-not $contentType) {
      $contentType = 'image/jpeg'
    }

    return "data:$contentType;base64,$([Convert]::ToBase64String($bytes))"
  } catch {
    return ''
  } finally {
    Close-IfPossible $reader
    Close-IfPossible $stream
  }
}

function Get-SessionSnapshot {
  $session = Get-MediaSession
  if ($null -eq $session) {
    return [ordered]@{
      ok = $true
      hasSession = $false
    }
  }

  $properties = $null
  try {
    $properties = Convert-WinRtAsync -Operation ($session.TryGetMediaPropertiesAsync()) -ResultType $script:MediaPropsType
  } catch {
    $properties = $null
  }

  $playback = $session.GetPlaybackInfo()
  $controls = $playback.Controls
  $timeline = $session.GetTimelineProperties()
  $title = [string]$properties.Title
  $artist = [string]$properties.Artist
  $sourceApp = [string]$session.SourceAppUserModelId
  $playbackStatus = [string]$playback.PlaybackStatus.ToString()

  return [ordered]@{
    ok = $true
    hasSession = [bool]($sourceApp -or $title -or $artist)
    sessionKey = ('{0}|{1}|{2}' -f $sourceApp, $title, $artist)
    sourceAppUserModelId = $sourceApp
    title = $title
    artist = $artist
    albumTitle = [string]$properties.AlbumTitle
    artworkDataUrl = Get-ThumbnailDataUrl $properties.Thumbnail
    playbackStatus = $playbackStatus
    isPlaying = $playbackStatus -eq 'Playing'
    positionSeconds = [Math]::Round($timeline.Position.TotalSeconds, 2)
    durationSeconds = [Math]::Round($timeline.EndTime.TotalSeconds, 2)
    supports = [ordered]@{
      play = [bool]$controls.IsPlayEnabled
      pause = [bool]$controls.IsPauseEnabled
      toggle = [bool]$controls.IsPlayPauseToggleEnabled
      next = [bool]$controls.IsNextEnabled
      previous = [bool]$controls.IsPreviousEnabled
    }
  }
}

function Invoke-SessionControl {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RequestedAction
  )

  $session = Get-MediaSession
  if ($null -eq $session) {
    return [ordered]@{
      ok = $false
      hasSession = $false
      action = $RequestedAction
      message = 'No active system media session.'
    }
  }

  switch ($RequestedAction) {
    'play' { $operation = $session.TryPlayAsync() }
    'pause' { $operation = $session.TryPauseAsync() }
    'toggle' { $operation = $session.TryTogglePlayPauseAsync() }
    'next' { $operation = $session.TrySkipNextAsync() }
    'previous' { $operation = $session.TrySkipPreviousAsync() }
    default { throw "Unsupported media control action: $RequestedAction" }
  }

  $result = [bool](Convert-WinRtAsync -Operation $operation -ResultType ([bool]))

  return [ordered]@{
    ok = $result
    hasSession = $true
    action = $RequestedAction
    message = if ($result) { '' } else { 'The player did not accept the requested control action.' }
  }
}

try {
  $payload = switch ($Action) {
    'snapshot' { Get-SessionSnapshot }
    'control' { Invoke-SessionControl -RequestedAction $Control }
  }

  $payload | ConvertTo-Json -Depth 5 -Compress
} catch {
  [ordered]@{
    ok = $false
    hasSession = $false
    action = if ($Action -eq 'control') { $Control } else { '' }
    message = $_.Exception.Message
  } | ConvertTo-Json -Depth 5 -Compress
}
