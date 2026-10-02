# Tracky2 V0.4 — Live hardware acceptance checklist

This checklist must be completed on real cameras and microphones. GitHub CI cannot perform it.

1. Serve Tracky2 on localhost or HTTPS and open diagnostics.html. Explicitly allow a supported camera.
2. Hold the green marker in each of the four equal vertical zones. Repeat with the blue marker. Keep diagnostics visible for at least eight seconds and export the JSON report.
3. Confirm the measured frame rate, detection confidence and visited zones. Review each dropout and rejected position jump in the report; note glare, lighting, background colors and camera selection.
4. Initiate the short microphone test and speak. Confirm the microphone is accessible and that a nonzero peak level is observed. No audio is saved.
5. Enroll at least two consenting participants on participants.html and optionally create Voice Profiles with the required enrollment samples. Test face recognition when facing the camera, full-body continuity when turning away, and correct behavior following occlusion.
6. Launch the shared four-zone two-player mode. Confirm that each completed round changes the common board to the other participant's assigned marker color, only that marker can score, partial repetitions reset when a marker disappears or makes an implausible jump, and participants retain independent scores.
7. Confirm optional speaker matching and transcription in the main game separately. A working microphone test alone does not validate voice identification accuracy.
8. Confirm opt-in local history saves scores and rounds only, clearing works, and participant deletion purges their saved history entries.

Record camera model, browser version, lighting conditions and observed issues separately. Mark the release hardware-certified only after all mandatory checks pass on representative devices. Neither CI nor an exported report by itself is proof of full hardware certification.
