/**
 * Workspace Separation On Dash
 * Makes the Dash (nearly) look as if the current workspace is the only one.
 * 
 * That means:
 * Favorites are displayed on all workspaces
 * Running Icons only for applications with windows on the current workspace
 * Workspace change through Dash-Click is prevented, a new window is opened instead 
 *
 * Contact:
 * Commit changes via https://github.com/Bazon/WorkspaceSeparationOnDash or bazonbloch@arcor.de
 * Feel free to send improvments!
 */


const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const AppDisplay = imports.ui.appDisplay;
const Shell = imports.gi.Shell;
const Clutter = imports.gi.Clutter;
const AppFavorites = imports.ui.appFavorites;
const Dash = imports.ui.dash;
const Lang = imports.lang;
const SD = imports.ui.search;

var _originalOnActivate = null;
var _originalActivate = null; //Bugfix in Version6
var _originalRedisplay = null;
var _originalWindowRemoved = null;
var connectid = null;
var connectid2 = null;



/** New in Version 4:
 * Modified version of the function in /usr/share/gnome-shell/js/ui/searchDisplay.js
 * Aim: Prevent workspace changes via hitting return in Search-Results
 */

function activate() {
        // Added: First check, whether the application (this.metaInfo.id) is running on the current workspace
	let windows = null;
        let isoncurrentworkspaceornoapp=0;
        //New in Version5: first TRY whether this.metaInfo.id is an app. it could also be a contact e.g.
        try {
            windows = this.metaInfo.id.get_windows();
            let activeWorkspace = global.screen.get_active_workspace();
	    
	    for (let i = 0; i < windows.length; i++) {
                if (windows[i].get_workspace() == activeWorkspace) {
		    isoncurrentworkspaceornoapp=1;	
                }
            }

        } catch(e) {
            isoncurrentworkspaceornoapp = 1; //here: it's no application
        }
        // If it's an app on the current workspace or no app, just activate, else open a new window
        if (isoncurrentworkspaceornoapp) {
            //new in version 7: added 2nd argument arcording to new /usr/share/gnome-shell/js/ui/searchDisplay.js
            this.provider.activateResult(this.metaInfo.id, this.terms);
        } else {
             this.metaInfo.id.open_new_window(-1);
        } 
        Main.overview.toggle();
}


/**
 * Modified version of the function in /usr/share/gnome-shell/js/ui/appDisplay.js
 * Aim: Prevent workspace changes via Clicks on Dash
 */
function  _onActivate(event) {

	// Added: First check, whether the application is running on the current workspace
	let windows = this.app.get_windows();
	let activeWorkspace = global.screen.get_active_workspace();
	let isoncurrentworkspace=0;

	for (let i = 0; i < windows.length; i++) {
            if (windows[i].get_workspace() == activeWorkspace) {
		isoncurrentworkspace=1;	
            }
        }

	//original function again:
        this.emit('launching');
        let modifiers = event.get_state();

        if (this._onActivateOverride) {
            this._onActivateOverride(event);
        } else {
            if (modifiers & Clutter.ModifierType.CONTROL_MASK
                && this.app.state == Shell.AppState.RUNNING) {
                this.app.open_new_window(-1);
            } else {
		// edited from original here: If not on current workspace, launch a new instance
		if (isoncurrentworkspace) {
                	this.app.activate();
		} else {
			this.app.open_new_window(-1);
		}
            }
        }
        Main.overview.hide();
}

/**
 * Modified version of the function in /usr/share/gnome-shell/js/ui/dash.js
 * Aim: Don't show icons from non-favorite applications that don't have a window on the current workspace
 */

function _redisplay() {
	// added: check later whether the application is running on the current workspace
	let activeWorkspace = global.screen.get_active_workspace();
	let isoncurrentworkspace=0;
	
	//original function, only edited "this" class if necessary
	this._appSystem = Shell.AppSystem.get_default();
	this._box = Main.overview._dash._box;

        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        let running = this._appSystem.get_running();
	
        let children = this._box.get_children().filter(function(actor) {
                return actor.child &&
                       actor.child._delegate &&
                       actor.child._delegate.app;
            });

        // Apps currently in the dash
        let oldApps = children.map(function(actor) {
                return actor.child._delegate.app;
            });
        // Apps supposed to be in the dash
        let newApps = [];

        for (let id in favorites)
            newApps.push(favorites[id]);

        for (let i = 0; i < running.length; i++) {
            let app = running[i];
            if (app.get_id() in favorites)
                continue;

	    //added: check whether there are windows on current workspace
	    let windows = app.get_windows();
	    isoncurrentworkspace=0;

	    for (let j = 0; j < windows.length; j++)  {
            	if (windows[j].get_workspace() == activeWorkspace) {
		    isoncurrentworkspace=1;	
           	}
            }

            if (isoncurrentworkspace)  //original function again:
                newApps.push(app);
        }

        // Figure out the actual changes to the list of items; we iterate
        // over both the list of items currently in the dash and the list
        // of items expected there, and collect additions and removals.
        // Moves are both an addition and a removal, where the order of
        // the operations depends on whether we encounter the position
        // where the item has been added first or the one from where it
        // was removed.
        // There is an assumption that only one item is moved at a given
        // time; when moving several items at once, everything will still
        // end up at the right position, but there might be additional
        // additions/removals (e.g. it might remove all the launchers
        // and add them back in the new order even if a smaller set of
        // additions and removals is possible).
        // If above assumptions turns out to be a problem, we might need
        // to use a more sophisticated algorithm, e.g. Longest Common
        // Subsequence as used by diff.
        let addedItems = [];
        let removedActors = [];

        let newIndex = 0;
        let oldIndex = 0;
        while (newIndex < newApps.length || oldIndex < oldApps.length) {
            // No change at oldIndex/newIndex
            if (oldApps[oldIndex] == newApps[newIndex]) {
                oldIndex++;
                newIndex++;
                continue;
            }

            // App removed at oldIndex
            if (oldApps[oldIndex] &&
                newApps.indexOf(oldApps[oldIndex]) == -1) {
                removedActors.push(children[oldIndex]);
                oldIndex++;
                continue;
            }

            // App added at newIndex
            if (newApps[newIndex] &&
                oldApps.indexOf(newApps[newIndex]) == -1) {
                addedItems.push({ app: newApps[newIndex],
                                  item: Main.overview._dash._createAppItem(newApps[newIndex]), //"this" replaced by "Main.overview._dash"
                                  pos: newIndex });
                newIndex++;
                continue;
            }

            // App moved
            let insertHere = newApps[newIndex + 1] &&
                             newApps[newIndex + 1] == oldApps[oldIndex];
            let alreadyRemoved = removedActors.reduce(function(result, actor) {
                let removedApp = actor.child._delegate.app;
                return result || removedApp == newApps[newIndex];
            }, false);

            if (insertHere || alreadyRemoved) {
                let newItem = Main.overview._dash._createAppItem(newApps[newIndex]);  //"this" replaced by "Main.overview._dash"
                addedItems.push({ app: newApps[newIndex],
                                  item: newItem,
                                  pos: newIndex + removedActors.length });
                newIndex++;
            } else {
                removedActors.push(children[oldIndex]);
                oldIndex++;
            }
        }

        for (let i = 0; i < addedItems.length; i++)
            this._box.insert_child_at_index(addedItems[i].item,
                                            addedItems[i].pos);

        for (let i = 0; i < removedActors.length; i++) {
            let item = removedActors[i];

            // Don't animate item removal when the overview is transitioning
            // or hidden
            if (Main.overview.visible && !Main.overview.animationInProgress)
                item.animateOutAndDestroy();
            else
                item.destroy();
        }

        Main.overview._dash._adjustIconSize();   //"this" replaced by "Main.overview._dash"

        // Skip animations on first run when adding the initial set
        // of items, to avoid all items zooming in at once

        let animate = this._shownInitially && Main.overview.visible &&
            !Main.overview.animationInProgress;

        if (!this._shownInitially)
            this._shownInitially = true;

        for (let i = 0; i < addedItems.length; i++) {
            addedItems[i].item.show(animate);
        }

        // Workaround for https://bugzilla.gnome.org/show_bug.cgi?id=692744
        // Without it, StBoxLayout may use a stale size cache
        this._box.queue_relayout();

}


/**
 * Modified version of the function in /usr/share/gnome-shell/js/ui/main.js
 * Needed to refresh Dash when the event occurs: last window of a non-favorite application on a workspace is closed via overview and the application has still windows on other workspaces
 */
function _windowRemoved(workspace, window) {
    //added to refresh Dash:
    _redisplay();

    //original function:
    _originalWindowRemoved(workspace, window);
}

function init() {
    _originalActivate = SD.SearchResult.prototype.activate;
    _originalOnActivate = AppDisplay.AppIcon.prototype._onActivate;
    _originalRedisplay = Main.overview._dash._redisplay;
    _originalWindowRemoved = Main._windowRemoved;
}

function enable() {
    SD.SearchResult.prototype.activate = activate;
    AppDisplay.AppIcon.prototype._onActivate = _onActivate;
    Main.overview._dash._redisplay = _redisplay;
    Main._windowRemoved = _windowRemoved;
    connectid = global.screen.connect('workspace-switched', function() {_redisplay();});
    connectid2 = Main.overview.connect('showing', function() {_redisplay();});
    Main.overview._dash._workId = Main.initializeDeferredWork(Main.overview._dash._box, Lang.bind(Main.overview._dash, _redisplay));
    _redisplay();
}

function disable() {
    SD.SearchResult.prototype.activate = _originalActivate;
    AppDisplay.AppIcon.prototype._onActivate = _originalOnActivate;
    Main.overview._dash._redisplay = _originalRedisplay;
    Main._windowRemoved = _originalWindowRemoved;
    global.screen.disconnect(connectid);
    Main.overview.disconnect(connectid2);
    Main.overview._dash._workId = Main.initializeDeferredWork(Main.overview._dash._box, Lang.bind(Main.overview._dash, Main.overview._dash._redisplay));
}
