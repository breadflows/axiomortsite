// Input smoothing uses exponential decay; collision sweeps stay below a body radius.
export function createMotion(){return {x:0,z:0};}
export function resetMotion(motion){motion.x=0;motion.z=0;}
export function movePlayer(player,motion,input,dt,canMove){
  const length=Math.max(1,Math.hypot(input.forward,input.side)),speed=input.speed;
  const tx=(-Math.sin(player.yaw)*input.forward+Math.cos(player.yaw)*input.side)/length*speed;
  const tz=(-Math.cos(player.yaw)*input.forward-Math.sin(player.yaw)*input.side)/length*speed;
  const rate=input.forward||input.side?16:24,decay=Math.exp(-rate*dt);
  const dx=tx*dt+(motion.x-tx)*(1-decay)/rate,dz=tz*dt+(motion.z-tz)*(1-decay)/rate;
  motion.x=tx+(motion.x-tx)*decay;motion.z=tz+(motion.z-tz)*decay;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
  for(let i=0;i<steps;i++){
    if(canMove(player.x+dx/steps,player.z))player.x+=dx/steps;else motion.x=0;
    if(canMove(player.x,player.z+dz/steps))player.z+=dz/steps;else motion.z=0;
  }
  return {dx,dz};
}
