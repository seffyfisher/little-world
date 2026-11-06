(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const W=1672,H=941,standingSize=W*.185;
  function fit(width,height){
    const scale=Math.max(0,Math.min(width/W,height/H));
    return {width:W*scale,height:H*scale,left:(width-W*scale)/2,top:(height-H*scale)/2};
  }
  const armchair={x:59.5,standingFeet:75,seatedFeet:70.5};
  // Measured centres of the book prop in the four generated transfer poses.
  const seatGrips=[[.57,.49],[.59,.53],[.58,.59]];
  const grips=[[.790,.346],[.735,.439],[.632,.522],[.544,.575]];
  const climbFeet=[[.3135,.9669],[.337,.9669],[.5097,.9669],[.453,.9669],[.337,.9696],[.3384,.9696],[.5083,.9669],[.4613,.9696]];
  const climbGrips=[[.474,.52],[.474,.525],[.474,.525],[.49,.53]];
  function shelf(index){return {x:1154+(index%4)*76,y:287+Math.floor(index/4)*111,width:W*.03,height:H*.084};}
  function walkPoint(x,y){return {x:Math.max(48.5,Math.min(77,Number.isFinite(x)?x:51)),y:Math.max(74,Math.min(79,Number.isFinite(y)?y:75))};}
  function shelfStand(index){const b=shelf(index),g=grips[0];return {x:(b.x+b.width/2-(g[0]-.5)*standingSize)/W*100,y:(b.y+b.height/2-(g[1]-.945)*standingSize)/H*100};}
  function ladder(index){
    if(index>=8)return null;
    const landing=shelfStand(index),tall=index<4,ratio=tall?.075:.15,footY=(.975-.945)*standingSize,footX=(.48-.5)*standingSize;
    const floor=75/100*H+footY,landY=landing.y/100*H+footY,height=(floor-landY)/(1-ratio),width=height*(tall?.681:1.33);
    const top=floor-height,left=landing.x/100*W+footX-(tall?.556:.5)*width;
    const treads=tall?[[1,.34],[.85,.36],[.69,.40],[.50,.45],[.30,.50],[ratio,.556]]:[[1,.35],[.68,.40],[ratio,.50]];
    const points=treads.map(([y,x])=>({x:(left+x*width-footX)/W*100,y:(top+y*height-footY)/H*100}));
    return {left,top,width,height,tall,points,base:points[0],landing:points.at(-1),duration:(points.length-1)*.64};
  }
  function climbMotion(index,progress,descending=false){
    const l=ladder(index),points=descending?[...l.points].reverse():l.points,p=Math.max(0,Math.min(1,progress))*(points.length-1),step=Math.min(points.length-2,Math.floor(p)),t=p-step;
    const move=Math.max(0,Math.min(1,(t-.38)/.62)),ease=move*move*(3-2*move),from=points[step],to=points[step+1];
    return {x:from.x+(to.x-from.x)*ease,y:from.y+(to.y-from.y)*ease,frame:progress>=1?3:move>0&&move<1?1:step%2?2:0};
  }
  function actor(c){
    // Bend the legs in the artwork; never shrink the whole person to fit the armchair.
    const size=standingSize;
    const progress=Math.max(0,Math.min(1,c.progress||0));
    const ease=progress*progress*(3-2*progress);
    const feet=c.phase==='sit-down'?armchair.standingFeet+(armchair.seatedFeet-armchair.standingFeet)*ease:c.phase==='stand-up'?armchair.seatedFeet+(armchair.standingFeet-armchair.seatedFeet)*ease:c.y;
    const pin=c.pose==='climb'?climbFeet[c.climbFrame||0]:[.48,.975];
    // Keep hips stable across alternating supporting feet; each foot uses its side of a tread.
    return {x:c.x/100*W-size/2+(c.pose==='climb'?.48-.43:0)*size,y:feet/100*H-size*.945+(.975-pin[1])*size,size};
  }
  function book(c){
    if(!c.book)return null;
    const a=actor(c),b=shelf(c.bookIndex),g=c.pose==='transfer'?grips[c.transferFrame]:c.pose==='climb'?climbGrips[Math.max(0,(c.climbFrame||4)-4)]:c.pose==='seat'?seatGrips[c.seatFrame===7?1:Math.min(2,c.seatFrame)]:[.56,.535];
    const gx=c.direction===-1?1-g[0]:g[0];
    return {x:a.x+gx*a.size-b.width/2,y:a.y+g[1]*a.size-b.height/2,width:b.width,height:b.height};
  }
  return {W,H,fit,armchair,grips,seatGrips,climbFeet,ladder,climbMotion,shelf,shelfStand,actor,book,walkPoint};
});
