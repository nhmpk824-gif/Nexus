Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

desktopPath = shell.SpecialFolders("Desktop")
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
targetVbs = projectDir & "\launch-latest.vbs"
iconPath = projectDir & "\public\nexus.ico"
shortcutPath = desktopPath & "\Nexus.lnk"

Set shortcut = shell.CreateShortcut(shortcutPath)
shortcut.TargetPath = "wscript.exe"
shortcut.Arguments = """" & targetVbs & """"
shortcut.WorkingDirectory = projectDir
shortcut.WindowStyle = 7
shortcut.Description = "Nexus Desktop Pet AI"

If fso.FileExists(iconPath) Then
    shortcut.IconLocation = iconPath & ",0"
End If

shortcut.Save

MsgBox "Nexus desktop shortcut created.", vbInformation, "Nexus"
