# UX/UI Test Report — Iteration 1
Generated: 2026-06-22T19:31:11.188Z

## Headline
```
errors=27 warnings=0 overflowPages=0 brokenLocalImg=0 localReqFail=27 navIssues=0 smallTapTargets=102 brokenLinks=25
  errors home/desktop: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err home/desktop: 404 /favicon.ico
  errors team/desktop: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err team/desktop: 404 /assets/media/heroes/team-hero.jpg
  errors team/mobile: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err team/mobile: 404 /assets/media/heroes/team-hero.jpg
  errors communities/desktop: Failed to load resource: the server responded with a status of 404 (Not Found) | Failed to load resource: the server responded with a status of 404 (Not Found) | Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err communities/desktop: 404 /assets/media/communities/moms-and-womens.jpg, 404 /assets/media/communities/mens-discipleship.jpg, 404 /assets/media/communities/womens-prayer.jpg
  errors communities/mobile: Failed to load resource: the server responded with a status of 404 (Not Found) | Failed to load resource: the server responded with a status of 404 (Not Found) | Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err communities/mobile: 404 /assets/media/communities/moms-and-womens.jpg, 404 /assets/media/communities/mens-discipleship.jpg, 404 /assets/media/communities/womens-prayer.jpg
  errors community-south-osborne/desktop: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err community-south-osborne/desktop: 404 /assets/media/heroes/mc-south-osborne.jpg
  errors community-south-osborne/mobile: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err community-south-osborne/mobile: 404 /assets/media/heroes/mc-south-osborne.jpg
  errors community-river-heights/desktop: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err community-river-heights/desktop: 404 /assets/media/heroes/mc-river-heights.jpg
  errors community-river-heights/mobile: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err community-river-heights/mobile: 404 /assets/media/heroes/mc-river-heights.jpg
  errors community-st-james/desktop: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err community-st-james/desktop: 404 /assets/media/heroes/mc-st-james.jpg
  errors community-st-james/mobile: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err community-st-james/mobile: 404 /assets/media/heroes/mc-st-james.jpg
  errors community-youth/desktop: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err community-youth/desktop: 404 /assets/media/heroes/mc-youth.jpg
  errors community-youth/mobile: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err community-youth/mobile: 404 /assets/media/heroes/mc-youth.jpg
  errors visit/desktop: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err visit/desktop: 404 /assets/media/heroes/visit-hero.jpg
  errors visit/mobile: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err visit/mobile: 404 /assets/media/heroes/visit-hero.jpg
  errors sermons/desktop: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err sermons/desktop: 404 /api/sermons
  errors sermons/mobile: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err sermons/mobile: 404 /api/sermons
  errors give/desktop: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err give/desktop: 404 /assets/media/heroes/give-hero.jpg
  errors give/mobile: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err give/mobile: 404 /assets/media/heroes/give-hero.jpg
  errors members-login/desktop: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err members-login/desktop: 404 /members/assets/media/heroes/communities-hero.jpg
  errors members-login/mobile: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err members-login/mobile: 404 /members/assets/media/heroes/communities-hero.jpg
  errors members-register/desktop: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err members-register/desktop: 404 /members/assets/media/heroes/communities-hero.jpg
  errors members-register/mobile: Failed to load resource: the server responded with a status of 404 (Not Found)
  http-err members-register/mobile: 404 /members/assets/media/heroes/communities-hero.jpg
BROKEN INTERNAL LINKS: ../index.html, ../about.html, ../team.html, ../believe.html, ../partnerships.html, ../communities.html, south-osborne.html, river-heights.html, st-james.html, youth.html, moms-and-womens.html, mens-discipleship.html, womens-prayer.html, ../gatherings.html, ../blog.html, ../sermons.html, ../give.html, ../visit.html, ../contact.html?mc=south-osborne, ../gospel.html, ../contact.html, ../contact.html?mc=river-heights, ../contact.html?mc=st-james, ../contact.html?mc=youth, ovcdonations@gmail.com
```

## Per-page detail
### home — `/index.html`
**desktop**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /favicon.ico
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/home__desktop.png`
**mobile**
- overflow: 0px
- console errors: 0
- page errors: 0
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): button.slideshow-dot.is-active[8x8], button.slideshow-dot[8x8], button.slideshow-dot[8x8], button.slideshow-dot[8x8], a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/home__mobile.png`

### about — `/about.html`
**desktop**
- overflow: 0px
- console errors: 0
- page errors: 0
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/about__desktop.png`
**mobile**
- overflow: 0px
- console errors: 0
- page errors: 0
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/about__mobile.png`

### team — `/team.html`
**desktop**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/team-hero.jpg
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/team__desktop.png`
**mobile**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/team-hero.jpg
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/team__mobile.png`

### believe — `/believe.html`
**desktop**
- overflow: 0px
- console errors: 0
- page errors: 0
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/believe__desktop.png`
**mobile**
- overflow: 0px
- console errors: 0
- page errors: 0
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/believe__mobile.png`

### gospel — `/gospel.html`
**desktop**
- overflow: 0px
- console errors: 0
- page errors: 0
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/gospel__desktop.png`
**mobile**
- overflow: 0px
- console errors: 0
- page errors: 0
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/gospel__mobile.png`

### partnerships — `/partnerships.html`
**desktop**
- overflow: 0px
- console errors: 0
- page errors: 0
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/partnerships__desktop.png`
**mobile**
- overflow: 0px
- console errors: 0
- page errors: 0
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/partnerships__mobile.png`

### communities — `/communities.html`
**desktop**
- overflow: 0px
- console errors: 3 — Failed to load resource: the server responded with a status of 404 (Not Found) | Failed to load resource: the server responded with a status of 404 (Not Found) | Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/communities/moms-and-womens.jpg, 404 /assets/media/communities/mens-discipleship.jpg, 404 /assets/media/communities/womens-prayer.jpg
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/communities__desktop.png`
**mobile**
- overflow: 0px
- console errors: 3 — Failed to load resource: the server responded with a status of 404 (Not Found) | Failed to load resource: the server responded with a status of 404 (Not Found) | Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/communities/moms-and-womens.jpg, 404 /assets/media/communities/mens-discipleship.jpg, 404 /assets/media/communities/womens-prayer.jpg
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/communities__mobile.png`

### community-south-osborne — `/communities/south-osborne.html`
**desktop**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/mc-south-osborne.jpg
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/community-south-osborne__desktop.png`
**mobile**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/mc-south-osborne.jpg
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/community-south-osborne__mobile.png`

### community-river-heights — `/communities/river-heights.html`
**desktop**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/mc-river-heights.jpg
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/community-river-heights__desktop.png`
**mobile**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/mc-river-heights.jpg
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/community-river-heights__mobile.png`

### community-st-james — `/communities/st-james.html`
**desktop**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/mc-st-james.jpg
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/community-st-james__desktop.png`
**mobile**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/mc-st-james.jpg
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/community-st-james__mobile.png`

### community-youth — `/communities/youth.html`
**desktop**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/mc-youth.jpg
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/community-youth__desktop.png`
**mobile**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/mc-youth.jpg
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/community-youth__mobile.png`

### gatherings — `/gatherings.html`
**desktop**
- overflow: 0px
- console errors: 0
- page errors: 0
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/gatherings__desktop.png`
**mobile**
- overflow: 0px
- console errors: 0
- page errors: 0
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/gatherings__mobile.png`

### visit — `/visit.html`
**desktop**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/visit-hero.jpg
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/visit__desktop.png`
**mobile**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/visit-hero.jpg
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/visit__mobile.png`

### sermons — `/sermons.html`
**desktop**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /api/sermons
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/sermons__desktop.png`
**mobile**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /api/sermons
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/sermons__mobile.png`

### blog — `/blog.html`
**desktop**
- overflow: 0px
- console errors: 0
- page errors: 0
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/blog__desktop.png`
**mobile**
- overflow: 0px
- console errors: 0
- page errors: 0
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[28x19], a[27x19]
- screenshot: `screenshots/blog__mobile.png`

### give — `/give.html`
**desktop**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/give-hero.jpg
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/give__desktop.png`
**mobile**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /assets/media/heroes/give-hero.jpg
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/give__mobile.png`

### contact — `/contact.html`
**desktop**
- overflow: 0px
- console errors: 0
- page errors: 0
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/contact__desktop.png`
**mobile**
- overflow: 0px
- console errors: 0
- page errors: 0
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/contact__mobile.png`

### members-login — `/members/`
**desktop**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /members/assets/media/heroes/communities-hero.jpg
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=3
- screenshot: `screenshots/members-login__desktop.png`
**mobile**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /members/assets/media/heroes/communities-hero.jpg
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): button.mp-toggle-pw[18x18], a[36x36], a[36x36], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/members-login__mobile.png`

### members-register — `/members/register.html`
**desktop**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /members/assets/media/heroes/communities-hero.jpg
- desktop nav: linksVisible=true hamburgerHidden=true dropdowns=0
- screenshot: `screenshots/members-register__desktop.png`
**mobile**
- overflow: 0px
- console errors: 1 — Failed to load resource: the server responded with a status of 404 (Not Found)
- page errors: 0
- local HTTP errors: 404 /members/assets/media/heroes/communities-hero.jpg
- mobile nav: ✅ hamburgerVisible=true linksHidden=true opens=true bodyLocked=true closes=true
- small tap targets (<40px): button.mp-toggle-pw[18x18], button.mp-toggle-pw[18x18], a[35x17], a[38x19], a[38x19], a[27x19]
- screenshot: `screenshots/members-register__mobile.png`

## ❌ Broken internal links
- ../index.html
- ../about.html
- ../team.html
- ../believe.html
- ../partnerships.html
- ../communities.html
- south-osborne.html
- river-heights.html
- st-james.html
- youth.html
- moms-and-womens.html
- mens-discipleship.html
- womens-prayer.html
- ../gatherings.html
- ../blog.html
- ../sermons.html
- ../give.html
- ../visit.html
- ../contact.html?mc=south-osborne
- ../gospel.html
- ../contact.html
- ../contact.html?mc=river-heights
- ../contact.html?mc=st-james
- ../contact.html?mc=youth
- ovcdonations@gmail.com