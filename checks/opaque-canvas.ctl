# The drawing buffer must be opaque (added 2026-11-21). Model materials keep masks ($selfillum) in the base texture's alpha,
# and with an alpha channel the page composited those pixels as invalid premultiplied colour: on macOS the a00 floor
# button and the cube on it showed black except their self-lit strips. Before the fix 71% of the pixels over them had
# alpha under 250; now the context has no alpha and every pixel reads 255.
map testchmb_a_00
fire entity_box_maker_rm1 ForceSpawn
step 10
eval (()=>{const cs=window.game.game.cubes, c=cs[cs.length-1]; c.pos=[-512,-929,175]; c.vel=[0,0,0]; c.asleep=false; c.sleep=0; return c.pos})()
step 264
assert (()=>{const c=window.game.game.cubes.find(c=>Math.hypot(c.pos[0]+512,c.pos[1]+929)<16); return c && c.pos[2] < 160})()
pose -581 -763 128 25 -67
step 1
screenshot /tmp/portal-checks/opaque-canvas.png
assert document.getElementById('c').getContext('webgl2').getContextAttributes().alpha === false
assert (()=>{ const g=window.game, gl=document.getElementById('c').getContext('webgl2'); g.render(); const W=gl.drawingBufferWidth,H=gl.drawingBufferHeight,px=new Uint8Array(W*H*4); gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px); for(let i=3;i<px.length;i+=4) if(px[i]!==255) return false; return true })()
errors
