# Swapp — Manual QA Test Plan

## 1. Auth — Register → Verify → Hunt

- [ ] TC-01: Navigate to `/` — Welcome screen loads with logo, "Start swapping" CTA, and green hero panel visible on desktop (≥1024px).
- [ ] TC-02: Tap "Start swapping" → Register form appears with Name, Email, Password fields and a "Create account" button.
- [ ] TC-03: Submit Register form with a new email → confirmation toast/message appears; no redirect yet.
- [ ] TC-04: Open the verification email and click the magic link → browser redirects to `/hunt`.
- [ ] TC-05: After verification, session is established — user stays on `/hunt` after a hard refresh.

## 2. Auth — Login → Verify → Hunt

- [ ] TC-06: On Welcome screen tap "Sign in" → Login form appears with Email and Password fields.
- [ ] TC-07: Enter wrong password → error message shown, no redirect.
- [ ] TC-08: Enter correct credentials → redirect to `/hunt`; TabBar (mobile) and DesktopNav (desktop) are visible.

## 3. Auth guard — unauthenticated redirect

- [ ] TC-09: While logged out, navigate directly to `/hunt` → redirected to `/` (Welcome screen).
- [ ] TC-10: While logged out, navigate directly to `/matches` → redirected to `/`.
- [ ] TC-11: While logged out, navigate directly to `/profile` → redirected to `/`.

## 4. Session persistence

- [ ] TC-12: Log in → navigate to `/hunt` → close and reopen the browser tab → still on `/hunt`, no login prompt.
- [ ] TC-13: Log in → navigate to `/profile` → hard refresh (Cmd/Ctrl+R) → profile data reloads without redirecting to `/`.

## 5. Hunt — card interactions

- [ ] TC-14: First card loads with item photo (or camera placeholder), title, owner name, city, and condition badge visible.
- [ ] TC-15: "Offer one of yours" strip shows thumbnails of the logged-in user's items; first item is pre-selected (green border + checkmark).
- [ ] TC-16: Drag card 150px to the right → green "LIKE" overlay appears while dragging; card flies off to the right; next card becomes top card.
- [ ] TC-17: Drag card 150px to the left → red "NOPE" overlay appears while dragging; card flies off to the left; next card becomes top card.
- [ ] TC-18: Drag card only 60px to the right then release → card snaps back to center; no swipe is recorded.
- [ ] TC-19: Drag card only 60px to the left then release → card snaps back to center; no swipe is recorded.
- [ ] TC-20: While dragging right, card rotates clockwise up to ~15°; while dragging left, card rotates counter-clockwise up to ~15°.
- [ ] TC-21: Tap the ♥ button → same effect as dragging right past threshold; next card shown.
- [ ] TC-22: Tap the X button → same effect as dragging left past threshold; next card shown.
- [ ] TC-23: Press right arrow key → card passes through "like" flow; next card shown.
- [ ] TC-24: Press left arrow key → card passes through "pass" flow; next card shown.
- [ ] TC-25: Like a card when no offer item is selected → alert "Pick one of your items to offer first!" is shown; card not dismissed.
- [ ] TC-26: Swipe right on a card whose owner has already swiped right on you → redirect to `/match/:id` (green match screen).
- [ ] TC-27: Swipe through all cards → empty-deck state renders: "You've seen everything nearby!" + "Add your item" button.
- [ ] TC-28: Clicking "Add your item" on the empty-deck state → navigates to `/add`.

## 6. Offer strip

- [ ] TC-29: Selecting a different thumbnail in the offer strip highlights it with green border and checkmark; previous item deselects.
- [ ] TC-30: Tapping the "+" (AddThumb) button in the offer strip → navigates to `/add`.
- [ ] TC-31: On desktop (≥1024px) the left rail shows the offer grid and category filter chips; offer strip below the card is hidden.

## 7. Add Item

- [ ] TC-32: On `/add`, tapping the photo upload area opens the device file picker; selecting photos shows previews.
- [ ] TC-33: Filling in Title, Story, selecting a category chip, and picking a condition level all update the form without errors.
- [ ] TC-34: Adding "wants" tags populates the tag list below the input.
- [ ] TC-35: Tapping "Save" with all required fields filled → item saved; navigates back to previous screen; new item appears in offer strip on `/hunt`.

## 8. Match screen

- [ ] TC-36: `/match/:id` shows green background, both users' names, both item cards (photo, title), and two action buttons.
- [ ] TC-37: Tapping "Say hi" → navigates to `/chat` for that swap.
- [ ] TC-38: Tapping "Keep hunting" → navigates to `/hunt`.

## 9. Chat screen

- [ ] TC-39: `/chat/:id` shows the pinned swap card at the top with both items and the swap stepper (Matched → Arranged → Swapped → Rated).
- [ ] TC-40: Typing a message and tapping Send → message appears in the thread immediately.
- [ ] TC-41: Tapping the "Details" button → opens swap detail panel or navigates to detail view.
- [ ] TC-42: Tapping the back arrow → returns to `/matches`.

## 10. Matches screen

- [ ] TC-43: `/matches` has three tabs — Active, Done, Cancelled — each showing the correct rows.
- [ ] TC-44: Tapping a row in the Active tab → navigates to `/chat/:id`.
- [ ] TC-45: Badge labels (e.g. "Matched", "Arranged") are visible on each row.
- [ ] TC-46: With no matches in a tab, an empty-state message is displayed.

## 11. Activity screen

- [ ] TC-47: Activity feed groups events under TODAY, YESTERDAY, and EARLIER headings.
- [ ] TC-48: A "Like back" button on a like-notification triggers a return like and updates the row.
- [ ] TC-49: A "Chat" button on a match-notification navigates to the correct `/chat/:id`.
- [ ] TC-50: A "Rate" button on a completed-swap notification navigates to the rate screen.

## 12. Profile screen

- [ ] TC-51: `/profile` loads the logged-in user's name, avatar initials, city, and item grid.
- [ ] TC-52: Moving the radius slider and saving → new radius value persists after a page refresh.
- [ ] TC-53: Tapping a grid item → opens the item detail or edit view.
- [ ] TC-54: Tapping "+" / "Add item" → navigates to `/add`.
- [ ] TC-55: Tapping "Sign out" → session cleared; redirect to `/`.

## 13. Settings screen

- [ ] TC-56: Notification toggles reflect current saved state on load.
- [ ] TC-57: Toggling a notification switch → preference saved (persists after refresh).
- [ ] TC-58: City picker allows selecting a new city; new city reflected in the Hunt location chip after save.
- [ ] TC-59: Tapping "Sign out" in Settings → session cleared; redirect to `/`.
- [ ] TC-60: Tapping "Delete account" → confirmation dialog appears before any action; confirming deletes account and redirects to `/`.

## 14. Cancel swap flow

- [ ] TC-61: Opening the Cancel flow shows a list of cancellation reasons (radio buttons or chips).
- [ ] TC-62: Selecting a reason and adding an optional note enables the "Confirm cancellation" button.
- [ ] TC-63: Confirming cancellation → swap status updated to "Cancelled"; redirect to `/matches` with swap now in Cancelled tab.
- [ ] TC-64: Tapping "Never mind" → navigates back without changing swap status.

## 15. Rate screen

- [ ] TC-65: Rate screen shows the other swapper's name and 5 interactive stars.
- [ ] TC-66: Tapping a star (e.g. 4 stars) highlights 1–4 and shows quick-tag chips (e.g. "Fast reply", "As described").
- [ ] TC-67: Selecting quick tags and adding a note text, then tapping "Send" → rating saved; navigates back.
- [ ] TC-68: Tapping "Skip" → no rating recorded; navigates back.

## 16. Desktop layout

- [ ] TC-69: At viewport width ≥1024px, `DesktopNav` sidebar is visible; mobile `TabBar` is hidden.
- [ ] TC-70: On Hunt at desktop width, 3-pane layout is active: left rail (offer + filters), center (card stack + FABs), right rail (item details).
- [ ] TC-71: On Matches at desktop width, split view shows conversation list on the left and chat thread on the right.
- [ ] TC-72: Desktop FAB area shows keyboard hint text "← pass · → like · keyboard works too".

## 17. Welcome / Register — desktop layout

- [ ] TC-73: On Welcome screen at ≥1024px, the green hero panel (brand illustration / tagline) is visible alongside the auth form.
- [ ] TC-74: On Register screen at ≥1024px, the green hero panel remains visible; the form does not stretch full-width.
