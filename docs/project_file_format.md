# Project File Format and Legacy Import

## Summary

The application now uses `.untirta` as the official project extension. The default Save As filename is:

`Ghani-NPSH-YYYYMMDD-HHMMSS.untirta`

Legacy `.hysys` files remain importable through `File > Import Legacy .hysys...` so older thesis scenarios can be migrated without losing work. After import, users should use Save As to write the official `.untirta` format.

## `.untirta` Container

`.untirta` is an opaque binary project container, not plain JSON:

1. Magic header: `UNTIRTA-NPSH-V1`
2. Fixed 8-character hexadecimal header length
3. UTF-8 JSON metadata header
4. Project payload bytes

The metadata header includes:

- `fileFormat`: `untirta-npsh-simulation`
- `fileVersion`: `1`
- `compression`: `gzip` when browser support is available, otherwise `none`
- `checksum`: SHA-256 checksum of the stored payload
- `payloadBytes`
- `savedAt`

The project payload still represents the same application model structure internally, but it is stored inside the checked container rather than exposed as a plain `.json` or `.hysys` file.

Level controller trend charts are stored inside the model payload as LIC result history. Each LIC keeps the latest bounded level samples, including PV level, set point level, alarm limits, net flow, level rate, and the current trend view state. When a project is opened, the saved samples are restored first and the load-time calculation pass is prevented from adding an extra artificial sample, so the chart can be rewound to the samples that existed when the user saved the file.

Dynamic tank inventory state is also stored in `model.SETTINGS.props`, including the selected inventory step size, selected realtime interval, and accumulated simulation time. Tank `liquidLevel`, liquid volume, and fill percentage are stored as normal tank properties/results after each `Simulate > Step Dynamic Inventory` action or realtime dynamic inventory tick.

## Legacy `.hysys` Import

Legacy `.hysys` files are treated as older JSON project exports from this application. They are only loaded through the import path:

- `File > Import Legacy .hysys...`
- File extension must be `.hysys`
- Imported projects clear the file handle, so Save writes through Save As to `.untirta`
- Legacy projects without `model.SETTINGS` are migrated by the existing settings migration logic

Open also accepts legacy files as a convenience, but the user is notified that Save As should be used to convert them to `.untirta`.

## Safety Rules

The import/open path validates and sanitizes data before applying it to the canvas:

- No `eval`, no dynamic function execution, and no HTML execution from file payload
- File size limit: 12 MB
- Object count limit: 600
- Connection count limit: 1200
- Array item limit: 6000
- String length limit: 5000 characters
- Total field limit: 60000
- Unsafe keys such as `__proto__`, `prototype`, and `constructor` are removed
- Non-finite numbers are rejected
- Load is atomic: if validation or apply fails, the previous canvas state is restored

This does not make a project file a security boundary against all possible browser attacks, but it prevents common risks from plain JSON project imports and reduces accidental project corruption.

## User Workflow

1. New project starts from the application defaults.
2. Save / Save As writes `.untirta`.
3. Open accepts `.untirta`.
4. Import Legacy `.hysys...` opens older `.hysys` files temporarily.
5. After a legacy import, use Save As to convert to `.untirta`.

## Notes

`.untirta` is intentionally application-specific. It is not compatible with Aspen HYSYS files. The `.hysys` import path exists only for older project exports created by this thesis application.
