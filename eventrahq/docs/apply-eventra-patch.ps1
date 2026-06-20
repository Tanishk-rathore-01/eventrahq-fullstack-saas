param([Parameter(Mandatory = $true)][string]$Base64)
& python -c 'import base64,subprocess,sys;p=base64.b64decode(sys.argv[1]).decode();exe=r''C:\Users\Tanishk\.vscode\extensions\openai.chatgpt-26.616.32156-win32-x64\bin\windows-x86_64\codex.exe'';sys.exit(subprocess.run([exe,''--codex-run-as-apply-patch'',p]).returncode)' $Base64
exit $LASTEXITCODE
