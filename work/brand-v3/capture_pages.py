from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/home/stars/Documents/Codex/2026-10-21/files-pasted-by-the-user-master/outputs/brand-v3')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for width,height in [(1440,900),(375,812)]:
        page=browser.new_page(viewport={'width':width,'height':height},color_scheme='light',reduced_motion='reduce')
        for path,name in [('/', 'friends'),('/my-timetable','timetable'),('/account','account'),('/admin','admin'),('/login','login'),('/admin/import','import')]:
            page.goto('http://127.0.0.1:3100'+path,wait_until='networkidle')
            page.evaluate('document.fonts.ready')
            page.screenshot(path=str(out/f'after-{name}-{width}.png'),full_page=True)
            print(name,width,'overflow',page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        page.close()
    browser.close()
