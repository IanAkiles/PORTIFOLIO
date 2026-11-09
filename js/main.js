const contactVideo=document.querySelector(".contact-animation");
const contactVideoButton=document.querySelector(".contact-art .video-play");
contactVideo.addEventListener("playing",()=>{contactVideoButton.hidden=true});
contactVideo.addEventListener("error",()=>{
contactVideoButton.textContent="Animação indisponível neste navegador";
contactVideoButton.disabled=true;
contactVideoButton.hidden=false;
});
contactVideoButton.addEventListener("click",()=>{
contactVideo.play().then(()=>{contactVideoButton.hidden=true}).catch(()=>{contactVideoButton.hidden=false});
});
if(matchMedia("(prefers-reduced-motion:reduce)").matches){
contactVideo.autoplay=false;
contactVideo.removeAttribute("autoplay");
contactVideo.pause();
contactVideoButton.hidden=false;
}
else contactVideo.play().catch(()=>{contactVideoButton.hidden=false});
const cookieKey="ian_cookie_notice";
const cookieNotice=document.getElementById("cookie-notice");
const hasCookieNotice=document.cookie.split("; ").some(cookie=>cookie.startsWith(`${cookieKey}=`));
cookieNotice.hidden=hasCookieNotice;
document.getElementById("cookie-acknowledge").addEventListener("click",()=>{
document.cookie=`${cookieKey}=acknowledged; Max-Age=15552000; Path=/; SameSite=Lax${location.protocol==="https:"?"; Secure":""}`;
cookieNotice.hidden=true;
});
document.getElementById("cookie-settings").addEventListener("click",()=>{cookieNotice.hidden=false});

const g=document.getElementById("grid"),d=document.getElementById("dlg");
P.forEach((p,i)=>{const n=String(i+1).padStart(3,"0"),b=document.createElement("button");b.className="card";
b.innerHTML=`<div class="thumb">${projectImages[p[0]]?`<img src="${projectImages[p[0]]}" alt="Imagem do projeto ${p[0]}" loading="lazy">`:""}<span>${p[1].toUpperCase()}</span>${maintenance.has(p[0])?`<div class="maint" role="note"><span>EM MANUTENÇÃO</span></div>`:""}</div><div class="name"><span>${p[0]}</span><i>+</i></div>`;
b.onclick=()=>{const s=getComputedStyle(b);document.getElementById("mv").style.setProperty("--m",s.getPropertyValue("--ac"));document.getElementById("mv").style.setProperty("--mt",s.getPropertyValue("--hc"));
document.getElementById("mv").innerHTML=`<span>${p[1].toUpperCase()}</span><b>${n}</b>`;
document.getElementById("mc").innerHTML=`<h2 style="margin:0">${p[0]}</h2><p class="mono" style="font-size:13px">${p[2]}</p>${maintenance.has(p[0])?`<p class="mono" role="status" style="font-size:12px;display:inline-block;padding:.3rem .6rem;background:#f5c518;color:#111;font-weight:700;letter-spacing:.1em">EM MANUTENÇÃO</p>`:""}<p class="mono" style="font-size:12px">${[p[6],p[7]].filter(Boolean).join(" · ")}</p><p>${p[3]}</p><div class="chips">${p[4].map(t=>`<span>${t}</span>`).join("")}</div>${p[5]?`<a class="btn" href="${p[5]}" target="_blank" rel="noopener">abrir projeto ↗</a>`:`<button class="btn" disabled style="opacity:.6">sem link público</button>`}`;d.showModal()};g.appendChild(b)});
document.getElementById("cls").onclick=()=>d.close();
d.addEventListener("click",e=>{if(e.target===d)d.close()});
// rastro do cursor
if(matchMedia("(pointer:fine)").matches&&!matchMedia("(prefers-reduced-motion:reduce)").matches){
const t=document.getElementById("trail"),characters=["}","]","/","=","+","-","|","{",";"],colors=[["#e63946","#fff"],["#f4a261","#171717"],["#e9c46a","#171717"],["#2a9d8f","#fff"],["#00a6fb","#111"],["#7b2cbf","#fff"],["#ff4d9d","#171717"],["#6a994e","#111"],["#1d3557","#fff"]];
let nextParticle=0;
addEventListener("mousemove",e=>{
const index=nextParticle++%characters.length,particle=document.createElement("i");
particle.className="trail-particle";particle.textContent=characters[index];
particle.style.setProperty("--trail-color",colors[index][0]);particle.style.setProperty("--trail-text",colors[index][1]);
particle.style.left=e.clientX+"px";particle.style.top=e.clientY+"px";
t.appendChild(particle);particle.addEventListener("animationend",()=>particle.remove(),{once:true});
});
}
