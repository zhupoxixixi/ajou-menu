async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const checks = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = new URL('?lang=cn&date=2026-10-23&meal=lunch', new URL('./', page.url())).href;
  await page.goto(url);
  await page.evaluate(() => MenuBackground.ready);
  const selection = await page.evaluate(() => ({date:state.date,meal:state.meal,restaurantId:state.restaurantId,sectionName:state.sectionName}));
  const sameSelection = async () => assert(await page.evaluate(expected => Object.entries(expected).every(([key,value])=>state[key]===value),selection), 'background action changed menu selection');
  const background = () => page.locator('#glassBackdrop').evaluate(node=>getComputedStyle(node).backgroundImage);
  await page.locator('#toolsToggle').click();
  await page.locator('#backgroundReset').click();
  await page.waitForFunction(()=>document.querySelector('#backgroundStatus').dataset.statusKey==='resetDone');
  assert((await background()).includes('default-background.svg'), 'default pattern was not applied');
  checks.push('default restores the static pattern');
  await page.locator('#backgroundWhite').click();
  await page.waitForFunction(()=>document.querySelector('#backgroundStatus').dataset.statusKey==='whiteDone');
  assert(await background()==='none', 'white option retained a background image');
  await page.reload(); await page.evaluate(()=>MenuBackground.ready);
  assert(await background()==='none', 'white option did not survive reload');
  checks.push('white background survives reload');
  await page.evaluate(async()=>{
    const c=document.createElement('canvas');c.width=20;c.height=20;
    const x=c.getContext('2d');x.fillStyle='#285473';x.fillRect(0,0,20,20);
    const b=await new Promise(r=>c.toBlob(r,'image/png'));
    await MenuBackground.selectFile(new File([b],'test-photo.png',{type:'image/png'}));
  });
  assert((await background()).includes('blob:'), 'custom picture did not override white');
  await page.reload(); await page.evaluate(()=>MenuBackground.ready);
  assert((await background()).includes('blob:'), 'custom picture was not restored');
  checks.push('custom picture overrides white and survives reload');
  await page.locator('#toolsToggle').click();
  await page.locator('#backgroundWhite').click();
  await page.waitForFunction(()=>document.querySelector('#backgroundStatus').dataset.statusKey==='whiteDone');
  await page.reload(); await page.evaluate(()=>MenuBackground.ready);
  assert(await background()==='none', 'white action left a saved picture that returned after reload');
  checks.push('white action removes saved custom picture');
  await page.locator('#toolsToggle').click();
  await page.locator('#backgroundReset').click();
  await page.waitForFunction(()=>document.querySelector('#backgroundStatus').dataset.statusKey==='resetDone');
  await page.reload(); await page.evaluate(()=>MenuBackground.ready);
  assert((await background()).includes('default-background.svg'), 'pattern reset did not persist');
  await sameSelection();
  checks.push('pattern reset persists and menu selection survives');
  await page.locator('#langToggle').click();
  await page.locator('#toolsToggle').click();
  assert(await page.locator('#backgroundWhite').innerText()==='흰색 배경', 'white control was not localized');
  await page.keyboard.press('Escape');
  await page.locator('#langToggle').click();
  checks.push('background controls localize with the page');
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&offlineState==='cacheReady');
  await page.context().setOffline(true);
  try {
    await page.reload(); await page.evaluate(()=>MenuBackground.ready);
    const cachedPattern=await page.evaluate(async()=>{
      const r=await fetch('assets/default-background.svg');
      return r.ok&&(await r.text()).includes('<svg');
    });
    assert(cachedPattern, 'static pattern is not available offline');
    checks.push('default pattern loads from the offline cache');
  } finally { await page.context().setOffline(false); }
  await page.reload(); await page.evaluate(()=>MenuBackground.ready);
  await page.locator('#toolsToggle').click();
  await page.evaluate(()=>{
    window.__backgroundSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key==='menuBackgroundStyle')throw new DOMException('blocked','SecurityError');return window.__backgroundSetItem.call(this,key,value);};
  });
  try {
    await page.locator('#backgroundWhite').click();
    await page.waitForFunction(()=>document.querySelector('#backgroundStatus').dataset.statusKey==='presetTemporary');
    assert(await background()==='none', 'storage denial prevented white background for current page');
    checks.push('storage denial applies the choice and reports that it cannot persist');
  } finally {
    await page.evaluate(()=>{Storage.prototype.setItem=window.__backgroundSetItem;delete window.__backgroundSetItem;});
  }
  await page.locator('#backgroundReset').click();
  await page.waitForFunction(()=>document.querySelector('#backgroundStatus').dataset.statusKey==='resetDone');
  await page.keyboard.press('Escape');
  assert(errors.length===0, 'browser errors: '+errors.join(', '));
  return {count:checks.length,checks,browserErrors:errors};
}
