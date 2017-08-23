/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* jshint esnext: true */
/* jshint -W097 */
/* global imports: false */
/**
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

'use strict';

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;
const Lib = Me.imports.lib;

const IndicatorMixin = {

  set manager(manager) {
    this._manager = manager;
    this.manager.connect('player-active-update', Lang.bind(this, this._commonOnActivePlayerUpdate));
    this.manager.connect('player-active-remove', Lang.bind(this, this._commonOnActivePlayerRemove));
  },

  get manager() {
    return this._manager;
  },

  _onScrollEvent: function(actor, event) {
    if (Settings.gsettings.get_boolean(Settings.MEDIAPLAYER_ENABLE_SCROLL_EVENTS_KEY)) {
      switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.UP:
          this.manager.activePlayer.previous();
        break;
        case Clutter.ScrollDirection.DOWN:
          this.manager.activePlayer.next();
        break;
      }
    }
  },

  _onButtonEvent: function(actor, event) {
    if (event.type() == Clutter.EventType.BUTTON_PRESS) {
      let button = event.get_button();
      if (button == 2 && this.manager.activePlayer) {
        this.manager.activePlayer.playPause();
        return Clutter.EVENT_STOP;
      }
    }
    return Clutter.EVENT_PROPAGATE;
  },

  // method binded to classes below
  _commonOnActivePlayerUpdate: function(manager, state) {
    if (this.panelIconSettingId) {
      this._settings.disconnect(this.panelIconSettingId);
    }
    this.useCoverInPanel = this._settings.get_enum(Settings.MEDIAPLAYER_STATUS_TYPE_KEY) == Settings.IndicatorStatusType.COVER;
    this.panelIconSettingId = this._settings.connect("changed::" + Settings.MEDIAPLAYER_STATUS_TYPE_KEY,
      Lang.bind(this, function() {
        this.useCoverInPanel =
          this._settings.get_enum(Settings.MEDIAPLAYER_STATUS_TYPE_KEY) == Settings.IndicatorStatusType.COVER;
        this._setPrimaryIndicatorIcon(null, null);
    }));   
    if (state.status) {
      if (state.status == Settings.Status.PLAY) {
        this._secondaryIndicator.icon_name = "media-playback-start-symbolic";
      }
      else if (state.status == Settings.Status.PAUSE) {
        this._secondaryIndicator.icon_name = "media-playback-pause-symbolic";
      }
      else if (state.status == Settings.Status.STOP) {
        this._secondaryIndicator.icon_name = "media-playback-stop-symbolic";
      }
      this._secondaryIndicator.show();
      this._secondaryIndicator.set_width(-1);
      this.indicators.show();
    }

    let stateTemplate = Settings.gsettings.get_string(Settings.MEDIAPLAYER_STATUS_TEXT_KEY);
    if(stateTemplate.length === 0 || state.status == Settings.Status.STOP) {
      this._thirdIndicator.hide();
      this._thirdIndicator.set_width(0);      
    } else {
      this._thirdIndicator.show();
    }

    if (state.trackTitle || state.trackArtist || state.trackAlbum || state.trackNumber) {
      let stateText = this.compileTemplate(stateTemplate, state);
      this._thirdIndicator.clutter_text.set_markup(stateText);

      // If You just set width it will add blank space. This makes sure the
      // panel uses the minimum amount of space.
      let prefWidth = Settings.gsettings.get_int(Settings.MEDIAPLAYER_STATUS_SIZE_KEY);
      this._thirdIndicator.clutter_text.set_width(-1);
      let statusTextWidth = this._thirdIndicator.clutter_text.get_width();
      if (statusTextWidth > prefWidth) {
        this._thirdIndicator.clutter_text.set_width(prefWidth);
        this._thirdIndicator.set_width(prefWidth);
      }
      else {
        this._thirdIndicator.clutter_text.set_width(-1);
        this._thirdIndicator.set_width(-1);
      }
    }

    if (state.trackCoverUrl !== null) {
      let desktopEntry = ''
      if(state.desktopEntry) {
        desktopEntry = state.desktopEntry;
      }
      this._setPrimaryIndicatorIcon(state.trackCoverUrl, desktopEntry);
    }
    this._onActivePlayerUpdate(state);
  },

  _setPrimaryIndicatorIcon: function(trackCoverUrl, desktopEntry) {
    if (trackCoverUrl != null) {
      this.currentCoverUrl = trackCoverUrl;
    }
    if (desktopEntry != null) {
      this.currentDesktopEntry = desktopEntry;
    }
    let fallbackIcon = 'audio-x-generic-symbolic';
    if(this.currentDesktopEntry) {
      fallbackIcon = this.getPlayerSymbolicIcon(this.currentDesktopEntry);
    }
    if (this.currentCoverUrl && this.useCoverInPanel) {
        this.setCoverIconAsync(this._primaryIndicator, this.currentCoverUrl, fallbackIcon);
    }
    else {
      this._primaryIndicator.icon_name = fallbackIcon;
    }
  },

  _commonOnActivePlayerRemove: function(manager) {
    this._primaryIndicator.icon_name = 'audio-x-generic-symbolic';
    if (this.panelIconSettingId) {
      this._settings.disconnect(this.panelIconSettingId);
    }
    this._clearStateText();
    this._thirdIndicator.set_width(0);
    this._secondaryIndicator.set_width(0);
    this._thirdIndicator.hide();
    this._secondaryIndicator.hide();
    this._onActivePlayerRemove();
  },

  _clearStateText: function() {
    this._thirdIndicator.text = "";
    this._thirdIndicator.clutter_text.set_width(0);
  }
};

const PanelIndicator = new Lang.Class({
  Name: 'PanelIndicator',
  Extends: PanelMenu.Button,

  _init: function() {
    this.parent(0.0, "mediaplayer");

    this._manager = null;
    this.compileTemplate = Lib.compileTemplate;
    this.setCoverIconAsync = Lib.setCoverIconAsync;
    this.getPlayerSymbolicIcon = Lib.getPlayerSymbolicIcon;

    this._settings = Settings.gsettings;
    this.useCoverInPanel = this._settings.get_enum(Settings.MEDIAPLAYER_STATUS_TYPE_KEY) == Settings.IndicatorStatusType.COVER;
    this.panelIconSettingId = 0;
    this.currentCoverUrl = '';
    this.currentDesktopEntry = '';

    this._settings.connect("changed::" + Settings.MEDIAPLAYER_RUN_DEFAULT,
      Lang.bind(this, function() {
        let runDefault = this._settings.get_boolean(Settings.MEDIAPLAYER_RUN_DEFAULT);
        if (runDefault) {
          this.actor.show();
        }
        else if (!this.manager.activePlayer) {
          this.actor.hide();
        }
    }));

    this.menu.actor.add_style_class_name('mediaplayer-menu');

    this.indicators = new St.BoxLayout({vertical: false});

    this._primaryIndicator = new St.Icon({icon_name: 'audio-x-generic-symbolic',
                                          style_class: 'system-status-icon indicator-item'});
    this._secondaryIndicator = new St.Icon({icon_name: 'media-playback-stop-symbolic',
                                            style_class: 'popup-menu-icon secondary-indicator indicator-item'});
    this._secondaryIndicator.hide();
    this._thirdIndicator = new St.Label({style_class: 'system-status-icon'});
    this._thirdIndicator.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    this._thirdIndicatorBin = new St.Bin({child: this._thirdIndicator});
    this._thirdIndicator.hide();

    this.indicators.add(this._primaryIndicator);
    this.indicators.add(this._secondaryIndicator);
    this.indicators.add(this._thirdIndicatorBin);

    this.actor.add_actor(this.indicators);
    this.actor.add_style_class_name('panel-status-button');
    this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
    if (!this._settings.get_boolean(Settings.MEDIAPLAYER_RUN_DEFAULT)) {
      this.actor.hide();
    }
  },

  // Override PanelMenu.Button._onEvent
  _onEvent: function(actor, event) {
    if (this._onButtonEvent(actor, event) == Clutter.EVENT_PROPAGATE)
      this.parent(actor, event);
  },

  _onActivePlayerUpdate: function(state) {
    if (this.manager.activePlayer) {
      this.actor.show();
    }
  },

  _onActivePlayerRemove: function() {
    if (!Settings.gsettings.get_boolean(Settings.MEDIAPLAYER_RUN_DEFAULT)) {
      this.actor.hide();
    }
  }

});
Lib._extends(PanelIndicator, IndicatorMixin);

const AggregateMenuIndicator = new Lang.Class({
  Name: 'AggregateMenuIndicator',
  Extends: PanelMenu.SystemIndicator,

  _init: function() {
    this.parent();

    this._manager = null;
    this.compileTemplate = Lib.compileTemplate;
    this.setCoverIconAsync = Lib.setCoverIconAsync;
    this.getPlayerSymbolicIcon = Lib.getPlayerSymbolicIcon;
    this._settings = Settings.gsettings;
    this.useCoverInPanel = this._settings.get_enum(Settings.MEDIAPLAYER_STATUS_TYPE_KEY) == Settings.IndicatorStatusType.COVER;
    this.panelIconSettingId = 0;
    this.currentCoverUrl = '';
    this.currentDesktopEntry = '';

    this._primaryIndicator = this._addIndicator();
    this._primaryIndicator.icon_name = 'audio-x-generic-symbolic';
    this._primaryIndicator.style_class = 'system-status-icon indicator-item'
    this._secondaryIndicator = this._addIndicator();
    this._secondaryIndicator.icon_name = 'media-playback-stop-symbolic';
    this._secondaryIndicator.style_class = 'popup-menu-icon secondary-indicator indicator-item';
    this._secondaryIndicator.hide();
    this._thirdIndicator = new St.Label({style_class: 'system-status-icon'});
    this._thirdIndicator.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    this._thirdIndicator.hide();
    this._thirdIndicatorBin = new St.Bin({child: this._thirdIndicator,
                                     y_align: St.Align.MIDDLE});
    this.indicators.add_actor(this._thirdIndicatorBin);
    this.indicators.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
    this.indicators.connect('button-press-event', Lang.bind(this, this._onButtonEvent));

    this.indicators.hide();
  },

  _onActivePlayerUpdate: function(state) {
    if (state.status && state.status === Settings.Status.STOP) {
      this.indicators.hide();
      this.indicators.set_width(0);
    }
    else if (state.status) {
      this.indicators.show();
      this.indicators.set_width(-1);
    }
  },

  _onActivePlayerRemove: function() {
    this.indicators.hide();
  }
});
Lib._extends(AggregateMenuIndicator, IndicatorMixin);
