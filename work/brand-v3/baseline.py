from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/home/stars/Documents/Codex/2026-10-21/files-pasted-by-the-user-master/outputs/brand-v3')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900},color_scheme='light',reduced_motion='reduce')
    for path,name in [('/', 'friends'),('/my-timetable','timetable'),('/account','account'),('/admin','admin'),('/login','login')]:
        page.goto('http://127.0.0.1:3100'+path,wait_until='networkidle')
        page.evaluate('document.fonts.ready')
        page.screenshot(path=str(out/f'before-{name}.png'),full_page=True)
    page.goto('http://127.0.0.1:3100/',wait_until='networkidle')
    assert page.locator('[data-brand="penguin"]').count()>0, 'RED: existing header still uses the abstract K, not approved penguin.'
    browser.close()
