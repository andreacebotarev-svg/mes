# UI/UX: Philosophy & Design System

## 1. Design Philosophy
The CryptMessenger UI is built on three pillars:
1. **Focus**: Minimalist interface that puts the conversation front and center.
2. **Speed**: Instant transitions and optimistic UI updates.
3. **Safety Visuals**: Constant visual cues (shields, fingerprints, status colors) to reassure the user about their security.

---

## 2. Mobile-First Architecture
The layout uses a responsive "Slide-and-Stack" approach:
- **Mobile (< 992px)**: Single pane view. The sidebar (chat list) is the default. Selecting a chat triggers a hardware-accelerated CSS transition (`translateX`) to slide the chat area over the sidebar.
- **Desktop (>= 992px)**: Dual pane view. Sidebar and Chat Area are visible simultaneously.
- **Bottom Navigation**: Essential actions (Chats, People, Settings) are accessible via a thumb-friendly bottom bar on mobile.

---

## 3. Aesthetics & Theming
- **Dark Mode (Default)**: Deep grays (`#0d0d12`) and high-contrast accents to reduce eye strain and save battery on OLED screens.
- **Glassmorphism**: Headers and overlays use `backdrop-filter: blur(10px)` with semi-transparent backgrounds to create depth.
- **Dynamic Avatars**: Users without photos get colorful avatars with initials. Colors are deterministically generated based on the user's handle to ensure consistency.

---

## 4. Animations & Micro-interactions
- **Hardware Acceleration**: All transitions use `transform` and `opacity` to ensure 60fps performance on mobile devices.
- **Reaction Pop**: Reactions animate with a "spring" effect (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`).
- **Infinite Scroll**: Message history loads smoothly as the user scrolls up, preventing UI freezes.

---

## 5. Reaction System
- **Contextual**: Hovering over a message (or long-pressing on mobile) reveals the reaction picker.
- **Stateful**: Reactions are togglable. Clicking an existing reaction increments/decrements the counter.
- **Real-time**: Reactions are synced instantly via Socket.io/SSE to all participants.

---

## 6. CSS Variable System
The entire UI is themed using CSS variables defined in `variables.css`, allowing for easy "Skins" or "Night Mode" toggling:
```css
:root {
  --bg-primary: #0d0d12;
  --accent: #6c5ce7;
  --text-main: #ffffff;
  --danger: #ff7675;
}
```
