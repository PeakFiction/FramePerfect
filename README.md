How to Use FramePerfect Combo Overlay: Setup for Windows 10/11 x64. Order matters.

# 1) Install prerequisites

* Node.js LTS (v20 or v22).
* .NET 8 SDK.
* ViGEmBus driver (Nefarius). Reboot after install.

# 2) Get the project on disk

* Put the repo anywhere, e.g. `C:\FramePerfect\overlay-electron`.

Expected paths:

```
overlay-electron\
  package.json
  main.js
  preload.js
  overlay.html / overlay.js / overlay.css
  launcher.html / launcher.js
  tools\win\FpPad\FpPad.csproj
  tools\win\FpPad\Program.cs
```

# 3) Install Node dependencies

PowerShell in `overlay-electron`:

```powershell
npm install
```

# 4) Build the ViGEm helper

PowerShell:

```powershell
cd .\tools\win\FpPad
dotnet build -c Release
cd ..\..\..\
```

Expected output:

```
overlay-electron\tools\win\FpPad\bin\Release\net8.0\FpPad.exe
```

# 5) Start the overlay

PowerShell in `overlay-electron`:

```powershell
npm start
```

# 6) Elevation rule

* If the game runs as Administrator, start the overlay **as Administrator** too.
* If the game runs normally, start the overlay normally.
  Mismatched elevation blocks input.

# 7) Controls and mapping (what the app records/plays)

* Directions: `W A S D` → D-pad ↑ ← ↓ →
* Tekken buttons (canonical): `J=1 (Square)`, `K=2 (Triangle)`, `M=3 (Cross)`, `,=4 (Circle)`
* Your layout: `U I J K` → `1 2 3 4` (UIJK are mapped onto the canonical J/K/M/COMMA)
* Options/Select: `B` = Options, `V` = Select
* Only the keys above are recorded.

# 8) Record

* Use the launcher window buttons:

  * Record
  * Save Recording
* Or shortcuts:

  * `Ctrl+Shift+R` start/stop record
  * `Ctrl+Shift+S` save
* While recording, press ONLY the mapped keys (UIJK, WASD, B, V). Releases are captured automatically.
* Save to a `.fpkeys` file when done.

# 9) Play back

* Ensure “Inject to virtual controller” is ON in the launcher (or toggle with `Ctrl+Shift+J` until the overlay status shows `Inject ON`).
* Click “Import & Play” and pick your `.fpkeys`, or press `Ctrl+Shift+I`.
* Stop playback with the launcher button or `Ctrl+Shift+P`.

# 10) Tekken setup

* Prefer Windowed Fullscreen/Borderless during validation.
* In Steam, if you use Steam Input, keep it consistent (either enabled for Xbox controllers or fully disabled) to avoid remapping conflicts.

# 11) Minimal sanity checks

* Overlay HUD toggles: `Ctrl+Shift+O`.
* Helper alive: no “FpPad missing” or “FpPad exited …” in the overlay status.
* Manual helper test (optional):

  ```powershell
  cd .\tools\win\FpPad\bin\Release\net8.0
  .\FpPad.exe
  ```

  Then type:

  ```
  tap M 60
  chord S,D,J 70
  ```

  Notepad should see A then df+1 if it’s focused; Tekken should see the equivalent controller inputs if the game window is focused.

# 12) Common failures and fixes

* **Overlay shows “FpPad missing”**
  You didn’t build step #4, or the output path is not `bin\Release\net8.0`. Rebuild exactly as shown.

* **No inputs in Tekken, but Notepad works**
  Elevation mismatch. Start both the game and overlay at the same elevation. Also confirm ViGEmBus is installed and the device appears briefly in Game Controllers when the overlay starts.

* **Imports play wrong buttons (e.g., 1→3)**
  You’re on an old `main.js`. Update to the version where `chooseAndPlay` bypasses `mapToPadKey()` for v2 files, and only uses `mapToPadKey()` during recording and v1 upgrade.

* **“No global key provider”**
  Native key hook failed to load. Run `npm install` again from `overlay-electron`. Make sure you’re on Windows and launching from PowerShell/Terminal, not from inside an IDE that changes env vars.

* **HUD visible but stutter**
  Ensure only one instance of the overlay is running. Close extra Electron windows. Keep inject ON only once (the launcher checkbox).

