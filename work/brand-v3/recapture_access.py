from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/home/stars/Documents/Codex/2026-10-21/files-pasted-by-the-user-master/outputs/brand-v3')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for width,height in [(375,812),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce')
        page.goto('http://127.0.0.1:3100/admin/access',wait_until='networkidle');page.evaluate('document.fonts.ready')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(out/f'after-access-{width}.png'),full_page=True)
        print(width,page.locator('.access-row > div').first.bounding_box())
        page.close()
    browser.close()
