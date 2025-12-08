const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Antivirus scanning helper (using ClamAV CLI mode on Windows)
// child_process.execFile example: https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback
// ClamAV scanning exit codes: https://docs.clamav.net/manual/Usage/Scanning.html
// Example project structure for scanning: https://github.com/kylefarris/clamscan
// fs temporary file handling: https://nodejs.org/api/fs.html#fswritefilesyncfile-data-options

// CLAM_PATH allows Windows users to define a full path
// CLAMAV_PATH="C:\\ClamAV\\clamscan.exe"
// keep flexible in case of deployment differences
const CLAM_PATH = process.env.CLAMAV_PATH || "clamscan.exe";

// Writes file to OS temp folder, scans it using ClamAV CLI, deletes after scan
// Returns: { infected: boolean, result: string }
async function scanWithClamAV(buffer: Buffer, originalName: string) {
    return new Promise((resolve) => {
        try {
            const tempDir = os.tmpdir();

            // Use a random filename so no collisions happen
            // note: learned this from multiple StackOverflow threads as Windows likes unique names
            const tempFilePath = path.join(
                tempDir,
                `scan-${Date.now()}-${Math.random().toString(16).slice(2)}-${originalName}`
            );

            // Write plaintext only temporarily for scanning (deleted immediately)
            fs.writeFileSync(tempFilePath, buffer);

            // Run clamscan.exe on the file
            execFile(CLAM_PATH, [tempFilePath], (error: any, stdout: string) => {
                let infected = false;

                // According to ClamAV docs:
                // Exit code 0 > OK
                // Exit code 1 > Infected
                if (error && error.code === 1) {
                    infected = true;
                }

                // delete temporary plaintext
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (err: any) {
                    // took me a while to get right — Windows sometimes locks files briefly
                    console.error("Temp cleanup error:", err);
                }

                return resolve({
                    infected,
                    result: stdout,
                });
            });
        } catch (err: any) {
            console.error("Antivirus scan failed:", err?.message);

            // Fallback: scanning failed but not necessarily infected
            return resolve({
                infected: false,
                result: "SCAN_FAILED",
            });
        }
    });
}

module.exports = { scanWithClamAV };
export {};