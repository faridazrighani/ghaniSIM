# Integrity Tests

Run the ghani3 hydraulic regression test with:

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tests\integrity-ghani3.cjs
```

The test defaults to `C:\Users\Zfaryana\Downloads\ghani3.hysys`.
To use another copy:

```powershell
$env:GHANI3_FILE = "C:\path\to\ghani3.hysys"
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tests\integrity-ghani3.cjs
```

The test starts the local preview server, loads the UI in Chrome, solves the file, and checks:

- pump flow follows connected SRC flow
- all PTF flow readouts follow SRC flow
- PTF pressure uses pipe tap interpolation
- PTF pressure unit is `bar a`
- ghani3 pump and sink solve without warnings
- realtime SRC mass-flow edits propagate to pump and PTF
