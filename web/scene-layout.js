(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LittleWorldLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const W=1672,H=941,standingSize=W*.185;
  function fit(width,height){
    const scale=Math.max(0,Math.min(width/W,height/H));
    return {width:W*scale,height:H*scale,left:(width-W*scale)/2,top:(height-H*scale)/2};
  }
  // The desk cases are foreground silhouettes, not transparent screen rectangles.
  const deskMonitors=[
    {bounds:{x:359,y:332,width:181,height:130},screen:{x:W*.228,y:H*.377,width:W*.082,height:H*.09},outline:[[379,333],[510,333],[530,337],[537,347],[540,441],[535,454],[522,461],[375,459],[364,453],[360,443],[359,351],[365,339]]},
    {bounds:{x:551,y:334,width:177,height:131},screen:{x:W*.343,y:H*.377,width:W*.0785,height:H*.09},outline:[[568,335],[704,336],[719,342],[725,352],[727,447],[721,460],[707,464],[567,460],[556,454],[552,444],[551,354],[557,341]]}
  ];
  // All six additions sit on the same rear wall, in two rows of three.
  const wallMonitors=[17.5,28.7].flatMap(top=>[14.1,24,33.9].map(left=>({left,top,width:8.8,height:10.42})));
  const deskForegroundOutlines=[...deskMonitors.map(m=>m.outline),
    [[310,325],[333,327],[355,369],[353,375],[337,379],[298,377],[276,372],[278,365],[298,330]],
    [[307,373],[325,373],[325,463],[307,463]],
    [[298,458],[329,458],[342,462],[344,470],[335,476],[293,476],[285,470],[287,463]]
  ];
  const officePicturePatch={x:685,y:163,width:154,height:178};
  const wallPhotoFrame={x:966,y:241,width:105,height:77};
  const windowPatch={x:201,y:150,width:275,height:325};
  const armchair={x:59.5,standingFeet:75,seatedFeet:70.5};
  // Fit the miniature, excluding only its empty photographed studio backdrop.
  const roomBounds={left:8,top:128,width:1648,height:704};
  function fitRoom(width,height,mode='contain'){
    const scale=Math.max(0,(mode==='cover'?Math.max:Math.min)(width/roomBounds.width,height/roomBounds.height));
    return {width:W*scale,height:H*scale,left:(width-roomBounds.width*scale)/2-roomBounds.left*scale,top:(height-roomBounds.height*scale)/2-roomBounds.top*scale};
  }
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
  return {W,H,deskMonitors,deskForegroundOutlines,officePicturePatch,wallPhotoFrame,windowPatch,wallMonitors,fit,fitRoom,roomBounds,armchair,grips,seatGrips,climbFeet,ladder,climbMotion,shelf,shelfStand,actor,book,walkPoint};
});
