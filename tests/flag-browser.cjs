// Run with Node and Playwright available: node tests/flag-browser.cjs [base URL] [artifact directory].
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.argv[2] || 'http://127.0.0.1:8874';
const artifacts = path.resolve(process.argv[3] || 'test-results');
const source = fs.readFileSync(path.join(__dirname, '../js/flag.js'), 'utf8');
const instrumented = source.replace('const meshes = flags.map', 'window.__flags = { flags, renderer, camera, T, state: () => ({active:active?.image.alt, frame, visible, failed}) }; const meshes = flags.map');
const labels = ['HTML5','CSS3','React','Visual Studio Code','Python','Linux','ChatGPT','Claude'];
fs.mkdirSync(artifacts, {recursive:true});

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const results=[];
  async function open(options={},mode='normal') {
    const context=await browser.newContext({viewport:{width:1440,height:1000},...options});
    const page=await context.newPage();
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/js/ribbon.js*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
    await page.route('**/js/mascot-boot.js*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
    await page.route('**/js/flag.js*',r=>r.fulfill({body:instrumented,contentType:'text/javascript'}));
    await page.addInitScript(()=>localStorage.setItem('cookie-notice-acknowledged','true'));
    if (['webgl','shader','save-data'].includes(mode)) await page.addInitScript(mode=>{
      if(mode==='save-data') Object.defineProperty(navigator,'connection',{value:{saveData:true}});
      if(mode==='webgl') {
        const get=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args)};
      }
      if(mode==='shader') for(const klass of [WebGLRenderingContext,WebGL2RenderingContext]) {
        const original=klass.prototype.shaderSource;
        klass.prototype.shaderSource=function(shader,body){original.call(this,shader,body+'\nINVALID_SHADER');};
      }
    },mode);
    if(mode==='missing-logo') await page.route('**/media/flag-logos/react.webp',r=>r.abort());
    await page.goto(base);
    if(await page.locator('#cookie-acknowledge').isVisible()) await page.locator('#cookie-acknowledge').click();
    await page.locator('#bandeira').scrollIntoViewIfNeeded();
    return {context,page,errors};
  }
  async function ready(page) {
    await page.waitForFunction(()=>document.querySelector('#bandeira').classList.contains('is-ready'));
    await page.waitForTimeout(350);
  }
  async function hitPoint(page,label) {
    return page.evaluate(label=>{
      const {flags,T,camera}=window.__flags;
      const f=flags.find(f=>f.image.alt===label);
      const p=f.mesh.geometry.attributes.position,uv=f.mesh.geometry.attributes.uv;
      const candidates=[];
      for(let i=0;i<p.count;i++) if(uv.getY(i)<.8 && uv.getY(i)>.2 && f.opaque({x:uv.getX(i),y:uv.getY(i)})) candidates.push(i);
      const centerX=label==='Claude'?.125:.5;
      candidates.sort((a,b)=>(uv.getX(a)-centerX)**2+(uv.getY(a)-.5)**2-((uv.getX(b)-centerX)**2+(uv.getY(b)-.5)**2));
      const v=new T.Vector3().fromBufferAttribute(p,candidates[0]);
      f.mesh.localToWorld(v); v.project(camera);
      const rect=document.querySelector('.photo-flag-canvas').getBoundingClientRect();
      return {x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2};
    },label);
  }
  try {
    for(const width of [1440,768,390,320]) {
      const {context,page,errors}=await open({viewport:{width,height:width>600?1000:844},isMobile:width<=600,hasTouch:width<=600});
      await ready(page);
      assert.equal(await page.locator('#bandeira img.is-rendered').count(),9);
      const geometry=await page.evaluate(()=>({nodes:__flags.flags.reduce((n,f)=>n+f.mesh.geometry.attributes.position.count,0),draws:__flags.renderer.info.render.calls,overflow:document.documentElement.scrollWidth>innerWidth}));
      assert.equal(geometry.nodes,1473); assert.equal(geometry.draws,9); assert.equal(geometry.overflow,false);
      const bounds=await page.evaluate(()=>{
        const {flags,T,camera}=__flags, rect=document.querySelector('#bandeira').getBoundingClientRect();
        return flags.map(f=>{
          const p=f.mesh.geometry.attributes.position; let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
          for(let i=0;i<p.count;i++) {const v=new T.Vector3().fromBufferAttribute(p,i);f.mesh.localToWorld(v);v.project(camera);const x=(v.x+1)*rect.width/2,y=(1-v.y)*rect.height/2;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
          return {label:f.image.alt,left,right,top,bottom,w:rect.width,h:rect.height};
        });
      });
      fs.writeFileSync(path.join(artifacts,`bounds-${width}.json`),JSON.stringify(bounds,null,2));
      await page.screenshot({path:path.join(artifacts,`initial-${width}.png`)});
      const photo=bounds.find(f=>!labels.includes(f.label));
      for(const item of bounds){assert.ok(item.left>=0&&item.right<=item.w&&item.top>=0&&item.bottom<=item.h,`clipped at ${width}: ${item.label}`);if(item!==photo)assert.ok(item.right<photo.left||item.left>photo.right||item.bottom<photo.top||item.top>photo.bottom,`overlap at ${width}: ${item.label}`);}
      const allLabels=await page.locator('#bandeira img').evaluateAll(imgs=>imgs.map(i=>i.alt));
      for(const label of allLabels) {
        const point=await hitPoint(page,label);
        await page.mouse.move(point.x,point.y);await page.mouse.down();
        assert.equal(await page.evaluate(()=>__flags.state().active),label,`pick ${width}: ${label}`);
        const before=await page.evaluate(label=>Array.from(__flags.flags.find(f=>f.image.alt===label).mesh.geometry.attributes.position.array),label);
        await page.mouse.move(point.x+26,point.y+30,{steps:5});await page.waitForTimeout(160);
        const motion=await page.evaluate(({label,before})=>{
          const p=__flags.flags.find(f=>f.image.alt===label).mesh.geometry.attributes.position.array;
          return Math.max(...p.map((v,i)=>Math.abs(v-before[i])));
        },{label,before});
        assert.ok(motion>.03,`elastic drag ${label}`);
        await page.mouse.up();assert.equal(await page.evaluate(()=>__flags.state().active),undefined);
        await page.waitForTimeout(200);
      }
      if(width===390) {
        const cdp=await context.newCDPSession(page),point=await hitPoint(page,'React');
        const before=await page.evaluate(()=>scrollY);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
        for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+10,y:point.y-i*10}]});
        assert.equal(await page.evaluate(()=>__flags.state().active),'React');
        assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before)<3);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:3,y:point.y}]});
        for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:3,y:point.y-i*20}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert.ok(await page.evaluate(()=>scrollY)>before+20,'outside transparent cloth allows scrolling');
        await page.locator('#bandeira').scrollIntoViewIfNeeded();
        results.push({name:'touch',drag:true,scrollOutside:true});
      }
      await page.waitForTimeout(800);
      await page.screenshot({path:path.join(artifacts,`flag-${width}.png`)});
      await page.emulateMedia({reducedMotion:'reduce'});
      assert.equal(await page.locator('#bandeira img').evaluateAll(imgs=>imgs.every(i=>getComputedStyle(i).opacity==='1')),true);
      assert.equal(await page.evaluate(()=>__flags.state().frame),0);
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.waitForTimeout(120);
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(350);
      assert.equal(await page.evaluate(()=>__flags.state().frame),0,'pause outside view');
      await page.locator('#bandeira').scrollIntoViewIfNeeded();await page.waitForTimeout(200);
      const point=await hitPoint(page,'Python');await page.mouse.move(point.x,point.y);await page.mouse.down();
      await page.setViewportSize({width:width+15,height:850});
      await page.waitForFunction(()=>__flags.state().active===undefined,null,{timeout:5000});
      assert.equal(await page.evaluate(()=>__flags.state().active),undefined,'resize releases drag');await page.mouse.up();
      await page.locator('.photo-flag-canvas').evaluate(el=>el.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
      assert.equal(await page.locator('#bandeira img').evaluateAll(imgs=>imgs.every(i=>getComputedStyle(i).opacity==='1')),true);
      assert.deepEqual(errors,[]);
      results.push({name:`viewport-${width}`,...geometry,allNineDraggable:true,reducedMotion:true,contextLoss:true,pause:true});
      await context.close();
    }
    for(const mode of ['reduced','save-data','webgl','shader','missing-logo']){
      const {context,page,errors}=await open(mode==='reduced'?{reducedMotion:'reduce'}:{},mode);
      if(mode==='missing-logo') {await ready(page);assert.equal(await page.locator('#bandeira img.is-rendered').count(),8);}
      else {
        await page.waitForFunction(()=>[...document.querySelectorAll('#bandeira img')].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:15000});
        if(mode==='shader')await page.waitForFunction(()=>window.__flags?.state().failed);
        assert.equal(await page.locator('#bandeira').evaluate(el=>el.classList.contains('is-ready')),false,`${mode} retains the static fallback`);
        assert.equal(await page.locator('#bandeira img').evaluateAll(imgs=>imgs.every(i=>getComputedStyle(i).opacity==='1')),true,`${mode} keeps all images visible`);
      }
      assert.deepEqual(errors,[]);results.push({name:mode,passed:true});await context.close();
    }
    {
      const page=await browser.newPage();let resume,requested=false;const blocked=new Promise(r=>resume=r);
      await page.route('**/js/ribbon.js*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
      await page.route('**/js/mascot-boot.js*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
      await page.route('**/js/flag.js*',r=>r.fulfill({body:source.replace('renderer.setClearColor','window.__renderer=renderer;renderer.setClearColor'),contentType:'text/javascript'}));
      await page.route('**/media/flag-logos/react.webp',async r=>{requested=true;await blocked;await r.continue();});
      await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#bandeira').scrollIntoViewIfNeeded();await page.waitForFunction(()=>window.__renderer);
      while(!requested)await new Promise(r=>setTimeout(r,20));
      await page.evaluate(()=>__renderer.getContext().getExtension('WEBGL_lose_context').loseContext());await page.waitForTimeout(100);resume();await page.waitForTimeout(1200);
      assert.equal(await page.locator('#bandeira').evaluate(el=>el.classList.contains('is-ready')),false,'context lost while textures load preserves static images');
      results.push({name:'context-loss-during-load',passed:true});await page.close();
    }
    fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results,null,2));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
