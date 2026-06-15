 # MyMaintenance

## Project Structure

```
root/
├── index.html              # Main entry point
├── pages/                  # All sub-pages
│   ├── about.html
│   ├── coming-soon.html
│   ├── dashboard.html
│   ├── login.html
│   ├── mydocuments.html
│   ├── myhomes.html
│   ├── myplanning.html
│   ├── myprofile.html
│   ├── mytools.html
│   ├── myvehicles.html
│   └── tool-floorplan.html # CAD-style floor plan designer
├── css/                    # Split CSS files
│   ├── auth.css
│   ├── banner.css
│   ├── button.css          # Buttons (turquoise accent, border-radius 8px)
│   ├── documents.css
│   ├── floorplan.css       # Floor plan layout, grid canvas, modals, filebar
│   ├── footer.css
│   ├── global.css          # Global styles & CSS vars
│   ├── grid.css            # Grid layouts
│   ├── header.css          # Navbar & sidebar
│   ├── homes.css
│   ├── planning.css
│   ├── profile.css
│   ├── style.css
│   └── tools.css
├── script/                 # JavaScript files
│   ├── app-config.js
│   ├── app.js
│   ├── script.js
│   ├── modules/
│   │   ├── auth.js
│   │   └── common-ui.js
│   └── pages/
│       ├── floorplan.js    # Canvas, grid, zoom, pan, file CRUD, modals
│       ├── myhomes-gallery.js
│       └── myplanning.js
├── svg/                    # SVG icons (Material-style)
├── img/                    # Images
└── README.md               # This file
```

## Installation

Clone & open `index.html` in a browser.

## Branch

`floorplanmaker2`
