# The ending outside the facility: the 2D sky and the sky_camera 3D skybox (added 2026-11-18).
# Writes /tmp/portal-checks/ending-*.png; expect sky on and sky off to differ, and two sky frames to be identical.
map escape_02
pose 192 0 69 -20 255
set showSky off
screenshot /tmp/portal-checks/ending-nosky.png
bench 20
set showSky on
screenshot /tmp/portal-checks/ending-sky.png
screenshot /tmp/portal-checks/ending-sky-again.png
bench 20
diff /tmp/portal-checks/ending-sky.png /tmp/portal-checks/ending-sky-again.png
diff /tmp/portal-checks/ending-nosky.png /tmp/portal-checks/ending-sky.png /tmp/portal-checks/ending-diff.png
look -45 90
screenshot /tmp/portal-checks/ending-up45.png
errors
