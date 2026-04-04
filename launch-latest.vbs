Option Explicit

Dim shell, fso
Dim projectDir, projectDirLower
Dim electronExe, distIndex
Dim cosyVoiceDir, cosyVoicePython, cosyVoiceModelDir
Dim buildCommand, launchCommand
Dim exitCode

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDirLower = LCase(projectDir)
electronExe = projectDir & "\node_modules\electron\dist\electron.exe"
distIndex = projectDir & "\dist\index.html"
cosyVoiceDir = "D:\LM\CosyVoice"
cosyVoicePython = cosyVoiceDir & "\.venv\Scripts\python.exe"
cosyVoiceModelDir = cosyVoiceDir & "\pretrained_models\CosyVoice-300M-SFT"

If Not fso.FileExists(electronExe) Then
  MsgBox "Desktop Pet AI launcher error: electron.exe was not found. Please run npm install in the project folder first.", vbCritical, "Desktop Pet AI"
  WScript.Quit 1
End If

StopProjectProcesses projectDirLower
EnsureCosyVoiceRunning

shell.CurrentDirectory = projectDir

buildCommand = "cmd.exe /c npm.cmd run build"
exitCode = shell.Run(buildCommand, 0, True)
If exitCode <> 0 Then
  MsgBox "Desktop Pet AI launcher error: build failed. Please open the project folder and run npm run build to inspect the error.", vbCritical, "Desktop Pet AI"
  WScript.Quit exitCode
End If

If Not fso.FileExists(distIndex) Then
  MsgBox "Desktop Pet AI launcher error: dist\index.html was not generated after build.", vbCritical, "Desktop Pet AI"
  WScript.Quit 1
End If

launchCommand = """" & electronExe & """ ."
shell.Run launchCommand, 1, False

Sub StopProjectProcesses(targetDirLower)
  Dim service, processes, proc, cmdLine

  Set service = GetObject("winmgmts:\\.\root\cimv2")
  Set processes = service.ExecQuery( _
    "SELECT ProcessId, Name, CommandLine FROM Win32_Process WHERE Name='electron.exe' OR Name='node.exe'")

  For Each proc In processes
    cmdLine = ""

    On Error Resume Next
    cmdLine = LCase(CStr(proc.CommandLine))
    On Error GoTo 0

    If Len(cmdLine) > 0 Then
      If InStr(cmdLine, targetDirLower) > 0 Then
        On Error Resume Next
        proc.Terminate()
        On Error GoTo 0
      End If
    End If
  Next
End Sub

Sub EnsureCosyVoiceRunning()
  Dim startCommand

  If IsPortOpen("127.0.0.1", 50000) Then
    Exit Sub
  End If

  If Not fso.FolderExists(cosyVoiceDir) Then
    Exit Sub
  End If

  If Not fso.FileExists(cosyVoicePython) Then
    Exit Sub
  End If

  If Not fso.FolderExists(cosyVoiceModelDir) Then
    Exit Sub
  End If

  startCommand = "cmd.exe /c cd /d """ & cosyVoiceDir & """ && """ & cosyVoicePython & """ runtime\python\fastapi\server.py --port 50000 --model_dir pretrained_models\CosyVoice-300M-SFT >> cosyvoice.out.log 2>> cosyvoice.err.log"
  shell.Run startCommand, 0, False

  Call WaitForPort("127.0.0.1", 50000, 20)
End Sub

Function WaitForPort(host, port, timeoutSeconds)
  Dim attempt, maxAttempts

  maxAttempts = timeoutSeconds
  For attempt = 1 To maxAttempts
    If IsPortOpen(host, port) Then
      WaitForPort = True
      Exit Function
    End If

    WScript.Sleep 1000
  Next

  WaitForPort = IsPortOpen(host, port)
End Function

Function IsPortOpen(host, port)
  Dim testCommand, exitCode

  testCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ""$r = Test-NetConnection -ComputerName '" & host & "' -Port " & CStr(port) & " -InformationLevel Quiet; if ($r) { exit 0 } else { exit 1 }"""
  exitCode = shell.Run(testCommand, 0, True)
  IsPortOpen = (exitCode = 0)
End Function
