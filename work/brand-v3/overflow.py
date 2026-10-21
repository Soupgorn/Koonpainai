from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);page=b.new_page(viewport={'width':768,'height':1024});page.goto('http://127.0.0.1:3100/',wait_until='networkidle');print(page.evaluate('''() => Array.from(document.querySelectorAll('body *')).filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1 && r.width>0}).map(e=>({tag:e.tagName,cls:e.className,x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width})).slice(0,20)'''));b.close()
