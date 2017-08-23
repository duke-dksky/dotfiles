A Gnome-Shell extension: https://extensions.gnome.org/extension/440/workspace-separation-on-dash/

Makes the Dash (nearly) look as if the current workspace is the only one.

That means: Favorites are displayed on all workspaces Running Icons only for applications with windows on the current workspace Workspace change through Dash-Click is prevented, a new window is opened instead

Contact: Commit changes via https://github.com/Bazon/WorkspaceSeparationOnDash or bazonbloch@arcor.de Feel free to send improvments!

Changelog

Version 9: Version for Gnome-Shell 3.12: imports.ui.searchDisplay --> imports.ui.search; (thanks Marc!)

Version 8: Version for Gnome-Shell 3.8 and 3.10 (only metadata.json adapted)

Version 7: Version for Gnome-Shell 3.8

    "AppWellIcon" is replaced by "AppIcon"
    the _redisplay() function is updated to its original in /usr/share/gnome-shell/js/ui/dash.js
    activateResult get's a second argument like in /usr/share/gnome-shell/js/ui/searchDisplay.js

Version 6: Bugfix. (Oops! Forgot a var.)

Version 5: Deleted a bug made in Version 4 for SearchResults which are no applications

Version 4: Prevent Workspace change on hitting Search Results with Return key

Version 3:

    updated compatibility in metdata.js for Gnome-Shell 3.6
    Improved code: call the original _windowRemoved function in /usr/share/gnome-shell/js/ui/main.js instead of just copying it.

Version 2:

    Better description in metadata.json (for extensions.gnome.org)
    Improved code: React on Show Overview now by connect event instead of monkey patch
    Now also recognizes the event: last window of a non-favorite application on a workspace is closed via overview and the application has still windows on other workspaces (which was missed before)
