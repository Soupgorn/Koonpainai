from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect
out=Path('/home/stars/Documents/Codex/2026-10-21/files-pasted-by-the-user-master/outputs/brand-v3')
routes=[('/', 'friends'),('/my-timetable','timetable'),('/friends/bean','friend'),('/account','account'),('/admin','admin'),('/login','login'),('/admin/import','import'),('/my-timetable/import','personal-import'),('/onboarding','onboarding'),('/onboarding/policy','policy'),('/pending-approval','approval'),('/admin/access','access'),('/not-a-page','not-found')]
results={'viewports':[],'errors':[],'asset_failures':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for width,height in [(375,812),(430,932),(768,1024),(1440,900),(1920,1080),(320,812)]:
        page=browser.new_page(viewport={'width':width,'height':height},color_scheme='light',reduced_motion='reduce')
        page.on('pageerror',lambda err:results['errors'].append(str(err)))
        page.on('response',lambda r:results['asset_failures'].append(r.url) if any(s in r.url for s in ['/brand/','/icons/','/favicon','/apple-touch']) and r.status>=400 else None)
        for path,name in routes:
            page.goto('http://127.0.0.1:3100'+path,wait_until='networkidle')
            page.evaluate('document.fonts.ready')
            overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth')
            assert not overflow,(path,width,'overflow')
            assert page.locator('footer, .preview-control, .schedule-note').count()==0
            expect(page.locator('[data-brand="penguin"]').first).to_be_visible()
            for image in page.locator('[data-brand="penguin"]').all():
                assert image.evaluate('(e)=>e.complete && e.naturalWidth>0')
            results['viewports'].append({'route':path,'width':width,'height':height,'overflow':False,'title':page.title()})
            if width in [375,1440]:page.screenshot(path=str(out/f'after-{name}-{width}.png'),full_page=True)
        page.close()
    # Check public configured login and original provider metadata without authenticating.
    page=browser.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce')
    page.goto('http://localhost:3000/login',wait_until='networkidle')
    expect(page.get_by_role('button',name='Continue with KMITL SSO')).to_be_enabled()
    assert page.locator('[data-brand="penguin"]').count()==1
    page.screenshot(path=str(out/'configured-login.png'),full_page=True)
    provider=page.request.get('http://localhost:3000/api/auth/providers').json()['keycloak']
    assert provider['callbackUrl'].endswith('/api/auth/callback/keycloak')
    assert provider['signinUrl'].endswith('/api/auth/signin/keycloak')
    page.close();browser.close()
assert not results['errors'],results['errors']
assert not results['asset_failures'],results['asset_failures']
(out/'browser-results.json').write_text(json.dumps(results,indent=2))
print(f"Passed {len(results['viewports'])} route/viewport checks, configured login and provider URL checks. No page errors or missing brand assets.")
