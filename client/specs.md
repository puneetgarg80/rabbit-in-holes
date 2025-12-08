
# UI Redesign Specifications

## Goal
Maximize the playable game board area on mobile devices and reduce UI clutter by moving secondary information (Logs, Hints) into collapsible drawers.

## Layout Strategy
- **Container**: Use `100dvh` (Dynamic Viewport Height) to prevent scrolling issues on mobile browsers.
- **Structure**: Flexbox column layout.
  1. **Header**: Minimal fixed top bar (Title + Rules button).
  2. **Main Content (Flex-Grow)**:
     - **Controls**: Compact row for Hole Count and Restart at the top.
     - **Board Area**: Takes up all remaining vertical space (`flex-1`). Holes are vertically centered.
     - **Action Bar**: Fixed button area at the bottom of the main content.
  3. **Bottom Navigation**: Fixed footer with two tabs: "Log" and "Hint".

## Components

### 1. Board
- **Appearance**: Open layout (removed white card background).
- **Fox Animation**: Sliding unicode fox positioned absolutely above the holes.
- **Feedback**: Text floats below the holes, animating on state changes.

### 2. Bottom Sheet (Drawer)
- **Behavior**: Clicking a bottom nav tab slides a drawer up from the bottom (approx 50-60% height).
- **Content**:
  - **Log Tab**: Displays the `Log` component.
  - **Hint Tab**: Displays the `Assistant` component.
- **Dismissal**: Clicking the backdrop or a close button hides the drawer.

### 3. Log Component
- **Refactor**: Remove fixed max-height. Allow it to fill the parent container (the drawer).
- **Style**: Cleaner list style with specific visual cues for "Found" vs "Possibilities Left".

### 4. Assistant Component
- **Refactor**: Remove the "Ask" button trigger wrapper. The component now assumes it is already visible inside the drawer and displays the "Ask" button or the Hint result directly.
