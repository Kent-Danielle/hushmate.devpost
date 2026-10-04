---
doc: scope
status: approved
---

# Hushmate

*Less shush, more hush.*

A live web app where housemates share their quiet times and can nudge each other anonymously when someone's being loud.

## The Unique Kernel
**Anonymous nudging.** When someone is being loud, you can nudge them without it coming from you. The reminder is phrased as if the app itself is speaking, never as a message from a housemate. That keeps it anonymous for everyone, even in a two-person house.

Housemates join the house together. In the learner's words, "housemates agreeing to be on the platform means they acknowledge boundaries", so a nudge is a gentle reminder, not a confrontation.

Disturbance is judged by the person trying to rest, not by a meter: there's no hardware and no always-on microphone.

## Who It's For
**Students in shared housing first. More broadly, anyone sharing a place with housemates**, which is common in Vancouver, where renting is more common than owning.

The picture: B is trying to sleep while A is loud in the living room. Today, B says nothing. "I had nothing because I was an introvert."

Some students also move between places, like weekends with friends or family. They need the house they're currently in to be the one that counts.

## The Core Loop
**Setup, once:** set your weekly quiet times. They can differ by day, for example one schedule for Monday, Wednesday and Friday and another for the rest of the week.

**Day to day:**
- Open the app to see **who's resting now**.
- Give a heads-up before you're likely to make noise, e.g. "coming home late, might make late dinner".

**When disturbed:** someone being loud gets an anonymous nudge from you, in the app's voice. You can nudge at any time, not only during your own quiet time (decided in `3-prd`). They can reply "got it", also anonymously.

**Why people return:** nudges come to them as notifications, and the house's quiet streak gives positive reinforcement.

## Inspiration & Identity
- **The app is the messenger.** Nudges read as a gentle reminder from the app (third person), never as a complaint from a person.
- **Simple, well executed.** "Something simple that can be well executed."
- **Positive reinforcement over enforcement.** A house streak, not penalties.
- **Not a chores-and-bills app.** Housemate apps like [Flatastic](https://apps.apple.com/us/app/flatastic-the-roommate-app/id840810742) have no noise or quiet-time features. This one focuses only on quiet time.
- **Name and identity (decided 2026-10-03):** **Hushmate**, tagline "Less shush, more hush." The visual identity is a "cozy midnight" look: dark pastels, flat, no mascot, Fredoka and Nunito, dark and light mode. Details are in `prd.md > Look and Feel`; brand sources are in `../planning/branding-hushmate.md` and `../planning/design-system/`.

## Why This Matters to the Learner
It comes from their own experience living with "louder than average housemates" as an introvert who said nothing. They think "most students who live in dorms can relate", and they see it as "pretty novel and unique in this space".

Their goal for this build: a first iteration that reaches 80% or more of what they have in mind, with no features they aren't aware of.

## What "Working" Looks Like
**A live, hosted app.** Open the link and use it straight away, with nothing to install. Onboarding shows how to turn on browser notifications. On iPhone, notifications need the app added to the Home Screen, and onboarding teaches that.

**The demo:**
1. A judge joins a **demo group** preloaded with housemates, weekly quiet-time schedules (some in the morning too) and a historical streak.
2. They see who's resting now and nudge one of the preloaded housemates.
3. There's no real housemate to nudge them back, so the demo group simulates one. A "TEST" nudge arrives within 10 minutes of finishing onboarding, then more at random intervals of 30 minutes to 2 hours.
4. The judge replies "got it".

The proving moment: a gentle, anonymous nudge arrives as a real notification on the judge's own device, from a house they joined minutes ago.

## The POC Boundary
**Now:**
- A hosted PWA, usable straight from a link, with onboarding for notifications (and Home Screen on iPhone)
- Signing up as a house and inviting housemates
- Multiple groups per person, with one active at a time
- Recurring weekly quiet times, with an intuitive per-day schedule editor
- A "who's resting now" live view
- **Anonymous nudge in the app's voice (the kernel)**
- An anonymous "got it" reply
- Planned-noise heads-ups ("coming home late, might make late dinner")
- A house streak, with the demo group preloaded with a history
- The demo group: preloaded housemates and schedules, plus simulated nudges

## Later
- One-off quiet times announced ahead, such as an interview or important call
- Email notifications as a fallback
- A native phone app, as a separate future iteration, for fuller notification support

## Explicitly Cut
- **Housemates privately state their needs and AI proposes quiet hours.** An agent suggestion; the learner didn't take it up.
- **AI rewording nudges to match how the recipient likes to be told.** An agent suggestion; the learner didn't take it up.
- **Noise detection** (microphone, decibel meters, hardware). The person trying to rest decides what's disturbing.
- **"Quiet time is starting" reminders.** Cut by the learner during `3-prd` (2026-10-03): "I feel like it will be annoying." For example, someone napping outside their scheduled quiet time could be startled. Notifications are reserved for nudges.

## Carried to `3-prd`
- What counts toward the streak, and how to keep it from discouraging people from nudging.
- How the demo group's simulated nudges behave over time (e.g. whether they ever stop), and how the "TEST" label appears.
