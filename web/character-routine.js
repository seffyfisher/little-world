/* Photo-space coordinates are percentages of the room plate. Pure clock, independent of rendering. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./scene-layout.js'):root.LittleWorldLayout,typeof module==='object'&&module.exports?require('./emotions.js'):root.LittleWorldEmotions);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LittleWorldRoutine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(layout,emotions){
  'use strict';
  // Stop beside the desk. Walking under the monitor overlays puts their screens on his head.
  const places={home:{x:51,y:75},office:{x:50,y:75},library:{x:63,y:75}};
  const chair={x:layout.armchair.x,y:layout.armchair.seatedFeet},momentPlace={x:48.5,y:76};
  const seatDuration=1.2;
  const active=new Set(['walk-to-ladder','climb-up','climb-down','walk-to-shelf','choose-book','take-book','shelf-release','walk-to-chair','sit-down','reading','stand-up','walk-to-return','return-book']);
  const ladderPhases=new Set(['walk-to-ladder','climb-up','climb-down','choose-book','take-book','return-book','shelf-release']);
  function create({random=Math.random}={}){
    let s={...places.home,phase:'idle',room:'home',pose:'idle',direction:1,held:false,book:null,bookIndex:-1,emotion:null};
    let target={...places.home},elapsed=0,wait=8,cycle=0,queuedRoom=null,pendingEmotion=null,moodDue=20+random()*15,bag=[],lastMood=null;
    let queuedPoint=null,pendingBook=null;
    let ladderPurpose='pickup',ladderExit='finish';
    const enter=(phase,pose)=>{s.phase=phase;s.pose=pose;elapsed=0;};
    const shelf=()=>layout.shelfStand(s.bookIndex);
    function walk(phase,point){target={...point};enter(phase,s.held?'carry':'walk');s.direction=target.x<s.x?-1:1;}
    function approachShelf(purpose){ladderPurpose=purpose;const l=layout.ladder(s.bookIndex);walk(l?'walk-to-ladder':purpose==='return'?'walk-to-return':'walk-to-shelf',l?l.base:shelf());}
    function descend(exit){ladderExit=exit;enter('climb-down','climb');}
    function finishRelease(){
      s.book=null;s.bookIndex=-1;
      if(pendingBook){const next=pendingBook;pendingBook=null;enter('idle','idle');read(next.books,false,next.index);}
      else if(pendingEmotion){s.room='home';walk('walk-to-emotion',momentPlace);}
      else {const room=queuedRoom||'office',point=queuedPoint||places[room];queuedRoom=null;queuedPoint=null;s.room=room;walk('visit',point);}
    }
    function nextMood(){
      if(!bag.length){
        bag=Object.keys(emotions.moods);
        for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
        if(bag[0]===lastMood)bag.push(bag.shift());
      }
      lastMood=bag.shift();return lastMood;
    }
    function startEmotion(){s.emotion=pendingEmotion;pendingEmotion=null;s.direction=1;enter('emotion','emotion');}
    function finishEmotion(){
      s.emotion=null;moodDue=75+random()*65;
      if(queuedRoom){const room=queuedRoom,point=queuedPoint||places[room];queuedRoom=null;queuedPoint=null;s.room=room;walk('visit',point);}
      else {enter('idle','idle');wait=14+random()*8;}
    }
    function express(name='next',reduced=false){
      name=name==='next'?nextMood():name;
      if(!emotions.moods[name])return false;
      pendingEmotion=name;
      if(reduced){
        s.held=false;s.book=null;s.bookIndex=-1;queuedRoom=null;Object.assign(s,momentPlace);startEmotion();
        if(name==='floor')elapsed=emotions.duration(emotions.moods.floor.frames.slice(0,4));
        return true;
      }
      if(!s.held&&s.book&&s.bookIndex<8&&['climb-up','climb-down','choose-book','shelf-release'].includes(s.phase)){
        if(s.phase==='choose-book'||s.phase==='shelf-release')descend('finish');return true;
      }
      if(s.held){
        if(s.phase==='reading')enter('stand-up','seat');
        return true;
      }
      if(s.emotion){
        if(s.emotion==='floor'&&s.phase==='emotion'){enter('emotion-recover','emotion');return true;}
        s.emotion=null;
      }
      s.book=null;s.bookIndex=-1;s.room='home';walk('walk-to-emotion',momentPlace);return true;
    }
    function visit(room,reduced=false){
      pendingBook=null;queuedPoint=null;
      room=Object.hasOwn(places,room)?room:'home';
      if(reduced){s={...s,...places[room],room,held:false,book:null,bookIndex:-1,emotion:null};enter('idle','idle');wait=16;pendingEmotion=null;queuedRoom=null;return;}
      if(!s.held&&s.book&&s.bookIndex<8&&['climb-up','climb-down','choose-book','shelf-release'].includes(s.phase)){
        queuedRoom=room;pendingEmotion=null;if(s.phase==='choose-book'||s.phase==='shelf-release')descend('finish');return;
      }
      if(s.held){
        queuedRoom=room;pendingEmotion=null;
        if(s.phase==='reading')enter('stand-up','seat');
        else if(!['climb-up','climb-down','walk-to-ladder','take-book','stand-up','return-book','shelf-release','walk-to-return'].includes(s.phase))approachShelf('return');
        return;
      }
      if(s.emotion){queuedRoom=room;pendingEmotion=null;if(s.emotion==='floor'){enter('emotion-recover','emotion');return;}finishEmotion();return;}
      pendingEmotion=null;
      s.book=null;s.bookIndex=-1;s.room=room;queuedRoom=null;walk('visit',places[room]);
    }
    function walkTo(x,y,reduced=false){
      const point=layout.walkPoint(x,y);visit('home',reduced);
      if(reduced){Object.assign(s,point);return;}
      if(s.held||s.emotion||s.pose==='climb'){queuedPoint=point;return;}
      walk('visit',point);
    }
    function selectBook(books,index,reduced=false){
      if(!Number.isInteger(index)||!books[index]?.cover||!books[index]?.url)return false;
      if(reduced){visit('home',true);return read(books,true,index);}
      queuedPoint=null;queuedRoom=null;pendingEmotion=null;
      if(!s.held&&s.book&&s.bookIndex<8&&['climb-up','climb-down','choose-book','shelf-release'].includes(s.phase)){
        pendingBook={books:books.map(book=>({...book})),index};if(s.phase==='choose-book'||s.phase==='shelf-release')descend('finish');return true;
      }
      if(s.held){pendingBook={books:books.map(book=>({...book})),index};if(s.phase==='reading')enter('stand-up','seat');return true;}
      if(s.emotion){pendingBook={books:books.map(book=>({...book})),index};if(s.emotion==='floor')enter('emotion-recover','emotion');return true;}
      s.book=null;s.bookIndex=-1;enter('idle','idle');return read(books,false,index);
    }
    function read(books,reduced=false,selectedIndex=null){
      if(active.has(s.phase)||s.emotion)return false;
      const available=books.map((book,index)=>({book,index})).filter(({book})=>book?.cover&&book?.url);
      // The bottom shelf is within the puppet's reach. Fewer books still work.
      const reachable=available.filter(({index})=>index>=8), choices=reachable.length?reachable:available;
      if(!choices.length)return false;
      const chosen=selectedIndex===null?choices[cycle++%choices.length]:available.find(({index})=>index===selectedIndex);
      if(!chosen)return false;
      s.book={...chosen.book};s.bookIndex=chosen.index;s.room='library';queuedRoom=null;
      if(reduced){Object.assign(s,chair,{held:true,direction:1});enter('reading','read');}
      else approachShelf('pickup');
      return true;
    }
    function tick(dt,{books=[],wander=true,suspended=false,reducedMotion=false}={}){
      if(suspended||reducedMotion||!Number.isFinite(dt)||dt<=0)return snapshot();
      dt=Math.min(dt,60);elapsed+=dt;moodDue-=dt;
      if(s.pose==='climb'){
        const l=layout.ladder(s.bookIndex),progress=Math.min(1,elapsed/l.duration),motion=layout.climbMotion(s.bookIndex,progress,s.phase==='climb-down');
        Object.assign(s,{x:motion.x,y:motion.y,direction:1});
        if(progress>=1){
          if(s.phase==='climb-up'){
            if(!s.held&&(pendingEmotion||queuedRoom||pendingBook))descend('finish');
            else enter(ladderPurpose==='return'?'return-book':'choose-book',ladderPurpose==='return'?'transfer':'reach');
          }else if(ladderExit==='chair'){
            if(pendingEmotion||queuedRoom||pendingBook)approachShelf('return');
            else walk('walk-to-chair',{x:chair.x,y:layout.armchair.standingFeet});
          }else finishRelease();
        }
      }else if(s.pose==='walk'||s.pose==='carry'){
        const dx=target.x-s.x,dy=target.y-s.y,distance=Math.hypot(dx,dy),step=Math.min(distance,dt*7.5);
        if(distance>0){s.x+=dx/distance*step;s.y+=dy/distance*step;}
        if(distance<=step+.001){
          s.x=target.x;s.y=target.y;
          if(s.phase==='walk-to-emotion')startEmotion();
          else if(s.phase==='walk-to-ladder'){s.direction=1;enter('climb-up','climb');}
          else if(s.phase==='walk-to-shelf'){s.direction=1;enter('choose-book','reach');}
          else if(s.phase==='walk-to-chair'){s.direction=1;enter('sit-down','seat');}
          else if(s.phase==='walk-to-return'){s.direction=1;enter('return-book','transfer');}
          else {enter('idle','idle');wait=16;}
        }
      }else if(s.phase==='choose-book'&&elapsed>=.45){
        s.held=true;enter('take-book','transfer');
      }else if(s.phase==='take-book'&&elapsed>=1.4){
        if(layout.ladder(s.bookIndex))descend('chair');else walk('walk-to-chair',{x:chair.x,y:layout.armchair.standingFeet});
      }else if(s.phase==='sit-down'&&elapsed>=seatDuration){
        Object.assign(s,chair,{direction:1});enter(pendingEmotion||queuedRoom?'stand-up':'reading',pendingEmotion||queuedRoom?'seat':'read');
      }else if(s.phase==='reading'&&elapsed>=36)enter('stand-up','seat');
      else if(s.phase==='stand-up'&&elapsed>=seatDuration){s.y=layout.armchair.standingFeet;approachShelf('return');}
      else if(s.phase==='return-book'&&elapsed>=1.4){
        s.held=false;enter('shelf-release','reach');
      }else if(s.phase==='shelf-release'&&elapsed>=.45){
        if(layout.ladder(s.bookIndex))descend('finish');else finishRelease();
      }else if(s.emotion){
        const sequence=s.phase==='emotion-recover'?emotions.moods[s.emotion].recovery:emotions.moods[s.emotion].frames;
        if(elapsed>=emotions.duration(sequence)){
          if(pendingEmotion){s.emotion=null;s.room='home';walk('walk-to-emotion',momentPlace);}
          else if(pendingBook){const next=pendingBook;pendingBook=null;s.emotion=null;enter('idle','idle');read(next.books,false,next.index);}
          else finishEmotion();
        }
      }else if(s.phase==='idle'&&wander&&elapsed>=wait){
        if(moodDue<=0)express();
        else if(!read(books))visit(s.room==='office'?'library':'office');
      }
      return snapshot();
    }
    function snapshot(){
      const progress=Math.min(1,elapsed/(s.phase==='take-book'||s.phase==='return-book'?1.4:seatDuration));
      const transferFrame=s.phase==='return-book'?3-Math.min(3,Math.floor(elapsed/.35)):Math.min(3,Math.floor(elapsed/.35));
      const sequence=s.emotion?(s.phase==='emotion-recover'?emotions.moods[s.emotion].recovery:emotions.moods[s.emotion].frames):null;
      const emotionFrame=sequence?emotions.at(sequence,elapsed).frame:0;
      const seatFrame=s.phase==='stand-up'?[6,2,7,0][Math.min(3,Math.floor(progress*4))]:Math.min(2,Math.floor(progress*3));
      const climbProgress=s.pose==='climb'?Math.min(1,elapsed/layout.ladder(s.bookIndex).duration):0;
      const climbFrame=s.pose==='climb'?layout.climbMotion(s.bookIndex,climbProgress,s.phase==='climb-down').frame+(s.held?4:0):0;
      return {...s,progress,transferFrame,seatFrame,emotionFrame,climbFrame,ladderVisible:!!s.book&&s.bookIndex<8&&ladderPhases.has(s.phase),stride:Math.floor(elapsed*6),readFrame:Math.floor(elapsed/2)%4,
        book:s.book?{...s.book}:null,moving:s.pose==='walk'||s.pose==='carry'};
    }
    function nextDelay(lowPower=false){
      if(s.pose==='climb')return lowPower?167:83;
      if(s.pose==='walk'||s.pose==='carry')return lowPower?167:83;
      if(s.pose==='transfer')return Math.max(16,(.35-elapsed%.35)*1000);
      if(s.phase==='sit-down'||s.phase==='stand-up')return lowPower?167:83;
      if(s.emotion){const sequence=s.phase==='emotion-recover'?emotions.moods[s.emotion].recovery:emotions.moods[s.emotion].frames;return Math.max(lowPower?500:16,emotions.at(sequence,elapsed).next*1000);}
      if(s.phase==='reading')return Math.max(16,Math.min((36-elapsed)*1000,lowPower?36000:(2-elapsed%2)*1000));
      if(s.phase==='choose-book'||s.phase==='shelf-release')return Math.max(16,(.45-elapsed)*1000);
      return Math.max(250,(wait-elapsed)*1000);
    }
    return {tick,visit,walkTo,read,selectBook,express,snapshot,nextDelay};
  }
  return {create};
});
