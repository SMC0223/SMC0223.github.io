(function () {
  const radians = degrees => degrees * Math.PI / 180;
  const evaluate = (l1,l2,a1,a2) => {
    const t1=radians(a1),t2=radians(a2);
    const x1=l1*Math.cos(t1),y1=l1*Math.sin(t1);
    return {x1,y1,x2:l2*Math.cos(t1+t2),y2:l2*Math.sin(t1+t2),x:x1+l2*Math.cos(t1+t2),y:y1+l2*Math.sin(t1+t2)};
  };
  globalThis.LectureRobotArm={evaluate};
  if(typeof document==='undefined')return;
  document.querySelectorAll('[data-robot-arm]').forEach(lab=>{
    const get=s=>lab.querySelector(s), all=s=>[...lab.querySelectorAll(s)];
    const angles=all('[data-robot-angle]'), lengths=all('[data-robot-length]');
    const fmt=n=>(Math.abs(n)<0.0005?0:n).toFixed(2);
    const point=(el,x,y)=>{el.setAttribute('x',x);el.setAttribute('y',y);};
    function render(){
      const valid=lengths.every(f=>f.value!==''&&f.checkValidity());
      lengths.forEach(f=>f.setAttribute('aria-invalid',String(f.value===''||!f.checkValidity())));
      if(!valid){get('[data-robot-result]').textContent='길이 입력 범위: 0.1~2 m';return;}
      const [l1,l2]=lengths.map(f=>Number(f.value)),[a1,a2]=angles.map(f=>Number(f.value));
      const v=evaluate(l1,l2,a1,a2),scale=270/(l1+l2),p=(x,y)=>[360+x*scale,250-y*scale];
      const [jx,jy]=p(v.x1,v.y1),[x,y]=p(v.x,v.y);
      get('[data-robot-link="1"]').setAttribute('d',`M360 250L${jx} ${jy}`);
      get('[data-robot-link="2"]').setAttribute('d',`M${jx} ${jy}L${x} ${y}`);
      get('[data-robot-joint]').setAttribute('cx',jx);get('[data-robot-joint]').setAttribute('cy',jy);
      get('[data-robot-tip]').setAttribute('cx',x);get('[data-robot-tip]').setAttribute('cy',y);
      get('[data-robot-projection]').setAttribute('d',`M${x} 250V${y}H360`);
      get('[data-robot-extension]').setAttribute('d',`M${jx} ${jy}l${60*Math.cos(radians(a1))} ${-60*Math.sin(radians(a1))}`);
      function arc(cx,cy,start,angle,r){return Array.from({length:41},(_,i)=>{const t=radians(start+angle*i/40);return `${i?'L':'M'}${cx+r*Math.cos(t)} ${cy-r*Math.sin(t)}`;}).join(' ');}
      get('[data-robot-arc="1"]').setAttribute('d',arc(360,250,0,a1,42));get('[data-robot-arc="2"]').setAttribute('d',arc(jx,jy,a1,a2,32));
      [1,2].forEach((n,i)=>{get(`[data-robot-deg="${n}"]`).textContent=`${angles[i].value}°`;const el=get(`[data-robot-link-label="${n}"]`);el.textContent=n===1?'l₁':'l₂';point(el,n===1?(360+jx)/2:(jx+x)/2,(n===1?(250+jy)/2:(jy+y)/2)-18);});
      const label=get('[data-robot-point]');label.textContent=`끝점 (${fmt(v.x)}, ${fmt(v.y)})`;point(label,x+16,y-24);
      const left=Math.min(360-l1*scale,jx-l2*scale,x)-55,right=Math.max(360+l1*scale,jx+l2*scale,x)+115;
      const top=Math.min(250-l1*scale,jy-l2*scale,y)-50,bottom=Math.max(250+l1*scale,jy+l2*scale,y)+50;
      const h=Math.max(bottom-top,(right-left)/1.44),w=h*1.44,ox=(left+right-w)/2,oy=(top+bottom-h)/2;
      get('.robot-scene').setAttribute('viewBox',`${ox} ${oy} ${w} ${h}`);
      get('[data-robot-axes]').setAttribute('d',`M${ox+20} 250H${ox+w-20}M360 ${oy+20}V${oy+h-20} M${ox+w-30} 244L${ox+w-20} 250L${ox+w-30} 256 M354 ${oy+30}L360 ${oy+20}L366 ${oy+30}`);
      point(get('[data-robot-axis-x]'),ox+w-15,244);point(get('[data-robot-axis-y]'),370,oy+25);
      point(get('[data-robot-scale]'),ox+12,oy+h-8);
      const c1=get('[data-robot-circle="1"]'),c2=get('[data-robot-circle="2"]');
      c1.setAttribute('r',l1*scale);c2.setAttribute('cx',jx);c2.setAttribute('cy',jy);c2.setAttribute('r',l2*scale);
      const u=[Math.cos(radians(a1+a2)),-Math.sin(radians(a1+a2))],n=[-u[1],u[0]];
      const g=(forward,side)=>`${x+forward*u[0]+side*n[0]} ${y+forward*u[1]+side*n[1]}`;
      get('[data-robot-gripper]').setAttribute('d',`M${g(19,-13)}L${g(0,-13)}L${g(0,13)}L${g(19,13)}`);
      [[360,250,jx,jy,1],[jx,jy,x,y,2]].forEach(([ax,ay,bx,by,id])=>{
        const len=Math.hypot(bx-ax,by-ay),nx=(by-ay)/len,ny=-(bx-ax)/len,mx=(ax+bx)/2,my=(ay+by)/2;
        get(`[data-robot-dimension="${id}"]`).setAttribute('d',`M${ax} ${ay}Q${mx+nx*65} ${my+ny*65} ${bx} ${by}`);
        point(get(`[data-robot-link-label="${id}"]`),mx+nx*47-18,my+ny*47);
      });
      let arrows='';
      [[360,250,0,a1,42,1],[jx,jy,a1,a2,32,2]].forEach(([cx,cy,start,angle,r,id])=>{
        const mid=radians(start+angle/2),end=radians(start+angle),sign=Math.sign(angle);
        const el=get(`[data-robot-angle-label="${id}"]`);el.textContent=id===1?'θ₁':'θ₂';point(el,cx+(r+17)*Math.cos(mid),cy-(r+17)*Math.sin(mid));
        if(sign){const ex=cx+r*Math.cos(end),ey=cy-r*Math.sin(end),tx=-Math.sin(end)*sign,ty=-Math.cos(end)*sign;arrows+=`M${ex} ${ey}l${-9*tx+4*ty} ${-9*ty-4*tx}l${-8*ty} ${8*tx}Z `;}
      });
      get('[data-robot-arrows]').setAttribute('d',arrows);
      const elbow=get('[data-robot-elbow-label]');elbow.textContent='(x₁, y₁)';point(elbow,jx+15,jy+22);
      get('[data-robot-elbow]').textContent=`관절: x₁ = ${fmt(v.x1)} m, y₁ = ${fmt(v.y1)} m`;
      const step=(l1+l2)/2;
      get('[data-robot-grid]').innerHTML=[-1,1].map(n=>{const q=360+n*step*scale,r=250-n*step*scale;return `<path d="M${q} 45V455M155 ${r}H565" stroke="#dfe7ee"/><text x="${q-15}" y="274" class="robot-tick">${fmt(n*step)}</text><text x="367" y="${r-6}" class="robot-tick">${fmt(n*step)}</text>`;}).join('');
      get('[data-robot-scale]').textContent=`단위: m · 최대 도달 거리 L₁ + L₂ = ${fmt(l1+l2)} m`;
      get('[data-robot-heading]').textContent=`θ₁ + θ₂ = ${a1}° + (${a2}°) = ${a1+a2}°`;
      get('[data-robot-x]').textContent=`${fmt(v.x1)} + (${fmt(v.x2)}) = ${fmt(v.x)} m`;
      get('[data-robot-y]').textContent=`${fmt(v.y1)} + (${fmt(v.y2)}) = ${fmt(v.y)} m`;
      get('[data-robot-result]').textContent=`x = ${fmt(v.x)} m · y = ${fmt(v.y)} m`;
    }
    [...angles,...lengths].forEach(f=>f.addEventListener('input',render));
    all('[data-robot-preset]').forEach(b=>b.addEventListener('click',()=>{b.dataset.robotPreset.split(',').forEach((v,i)=>angles[i].value=v);lengths[0].value=1;lengths[1].value=0.8;render();}));
    lab.addEventListener('keydown',e=>{if(e.target.matches('input,button'))e.stopPropagation();});render();
  });
})();
