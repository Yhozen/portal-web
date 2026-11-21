# Model $selfillum. VertexLitGeneric masks a self-lit term with the base texture's alpha, and drops $selfillum when the
# base texture has no alpha (no ONEBITALPHA / EIGHTBITALPHA flag). Views: GLaDOS (DXT5, masked lights), a10's lift
# platform and a14's light-rail platform (DXT1: should look the same as plain lit), a11's turret (DXT1) and a cube (DXT5).
map escape_02
set showViewModel off
step 100
pose 9390 880 560 0 90
lookat 9390 1170 690
step 61
screenshot /tmp/portal-checks/selfillum/OUT-glados.png
lookat off
map testchmb_a_10
set showViewModel off
pose -128 560 40 20 90
screenshot /tmp/portal-checks/selfillum/OUT-a10-lift.png
map testchmb_a_14
set showViewModel off
pose 1742 700 1150 15 90
screenshot /tmp/portal-checks/selfillum/OUT-a14-rail.png
map testchmb_a_11
set showViewModel off
pose 330 -672 1 10 0
screenshot /tmp/portal-checks/selfillum/OUT-a11-turret.png
map testchmb_a_00
set showViewModel off
noclip off
fire logic_drop_box Trigger
step 200
pose -814 -1130 140 25 90
screenshot /tmp/portal-checks/selfillum/OUT-a00-cube.png
