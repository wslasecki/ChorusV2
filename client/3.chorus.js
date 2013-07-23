var ChorusRouter, Messages, Rooms, Router, UTCNow, hideMessageAlert, instachat, joinRoom, scrollMessagesView, showUnreadMessagesAlert, unreadMessage;

Rooms = new Meteor.Collection("rooms");
Messages = new Meteor.Collection("messages");

Session.set('room_name', null);
Session.set('nick', $.cookie("nick") || "");
Session.set('mute', $.cookie("mute"));

// Globals
instachat = {};
instachat["UTCOffset"] = new Date().getTimezoneOffset() * 60000;
instachat["alertWhenUnreadMessages"] = false;
instachat["messageAlertInterval"] = null;
instachat["unreadMessages"] = 0;

// Collection Subscriptions
Meteor.subscribe('rooms');

Meteor.autosubscribe(function () {
	var room_name;
	room_name = Session.get('room_name');
	if (room_name) {
		return Meteor.subscribe('messages', room_name);
	}
});

Meteor.autosubscribe(function () {
	return Messages.find({
		room_name: Session.get("room_name")
	}).observe({
			added: function (item) {
				scrollMessagesView();
				if (!item.system) {
					return unreadMessage(item);
				}
			}
		});
});

// Template Binding
Template.messages.messages = function () {
	return Messages.find();
};

Template.messages.pretty_ts = function (timestamp) {
	var d, min;
	if (!timestamp) {
		return;
	}
	d = new Date(timestamp);
	min = d.getMinutes();
	min = min < 10 ? "0" + min : min;
	return d.getHours() + ":" + min;
};

Template.nickAndRoom.nick = function () {
	return Session.get("nick");
};

Template.nickAndRoom.room = function () {
	return Session.get("room_name");
};

Template.nickAndRoom.volumeIcon = function () {
	if (Session.get("mute")) {
		return "icon-volume-off";
	} else {
		return "icon-volume-up";
	}
};

Template.nickModal.nick = function () {
	return Session.get("nick");
};

// Utility functions
joinRoom = function (roomName) {
	var room;
	room = Rooms.findOne({
		name: roomName
	});
	if (!room) {
		Rooms.insert({
			name: roomName
		});
	}
	Session.set("room_name", roomName);
	$.cookie("room_name", roomName, {
		expires: 365
	});
	Router.goToRoom(roomName);
	scrollMessagesView();
	$("#messageInput").select();
	return Meteor.call("newMessage", {
		system: true,
		body: Session.get("nick") + " just joined the room.",
		room_name: Session.get("room_name")
	});
};

scrollMessagesView = function () {
	return setTimeout(function () {
		return $("#messagesInner").scrollTop(10000);
	}, 200);
};

UTCNow = function () {
	var now;
	now = new Date();
	return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
};

// Event Handlers
$("#mute").live("click", function () {
	if (Session.get("mute")) {
		$.cookie("mute", null);
	} else {
		$.cookie("mute", true, {
			expires: 365
		});
	}
	return Session.set("mute", $.cookie("mute"));
});

$(window).resize(function () {
	return $("#content").height($(window).height() - $("#content").offset().top - $("#footer").height());
});

$("#joinRoom").live("submit", function () {
	var roomName;
	roomName = $("#roomName").val();
	if (!roomName) {
		return;
	}
	joinRoom(roomName);
	return false;
});

$("#nickPick").live("submit", function () {
	var $warning, nick;
	$warning = $(this).find(".warning");
	nick = $("#nickInput").val().replace(/^\s+|\s+$/g, "");
	$warning.html("");
	if (!nick || nick.length > 20) {
		$warning.html("Your nickname must be between 1 and 20 characters long!");
	} else {
		$.cookie("nick", nick, {
			expires: 365
		});
		Session.set("nick", nick);
		$('#nickPickModal').modal('hide');
		if ($.cookie("room_name")) {
			joinRoom($.cookie("room_name"));
		} else {
			joinRoom('General');
		}
	}
	hideMessageAlert();
	return false;
});

$("#messageForm").live("submit", function (e) {
	var $message, message;
	$message = $("#messageInput");
	message = $message.val();
	$message.val("");
	if (message) {
		Meteor.call('newMessage', {
			nick: Session.get("nick"),
			body: message,
			room_name: Session.get("room_name")
		});
	}
	return false;
});

// alert for unread messages
$("#messageInput").live("blur", function () {
	return instachat.alertWhenUnreadMessages = true;
});

$("#messageInput").live("focus", function () {
	instachat.alertWhenUnreadMessages = false;
	hideMessageAlert();
	return instachat.unreadMessages = 0;
});

showUnreadMessagesAlert = function () {
	if (instachat.messageAlertInterval) {
		return;
	}
	return instachat.messageAlertInterval = window.setInterval(function () {
		var msg, title;
		title = $("title");
		if (title.html() === "Chorus") {
			msg = instachat.unreadMessages === 1 ? "message" : "messages";
			return title.html(instachat.unreadMessages + " new " + msg + " - Chorus");
		} else {
			return title.html("Chorus");
		}
	}, 1000);
};

hideMessageAlert = function () {
	window.clearInterval(instachat.messageAlertInterval);
	instachat.messageAlertInterval = null;
	return window.setTimeout(function () {
		return $("title").html("Chorus");
	}, 1000);
};

unreadMessage = function (doc) {
	if (!(doc["nick"] === Session.get("nick") || Session.get("mute"))) {
		instachat.unreadMessageSound.play();
	}
	if (instachat.alertWhenUnreadMessages) {
		instachat.unreadMessages += 1;
		return showUnreadMessagesAlert();
	}
};

// Router
ChorusRouter = Backbone.Router.extend({
	routes: {
		"room/:roomName": "changeRoom"
	},
	changeRoom: function (roomName) {
		return $.cookie("room_name", roomName, {
			expires: 365
		});
	},
	goToRoom: function (roomName) {
		return this.navigate("/room/" + roomName, true);
	}
});

Router = new ChorusRouter();

Backbone.history.start({
	pushState: true
});

//stubs
Meteor.methods({
	newMessage: function (args) {
		var newMsg;
		newMsg = {};
		newMsg["body"] = args.body;
		if (args.nick) {
			newMsg["nick"] = args.nick;
		}
		if (args.system) {
			newMsg["system"] = args.system;
		}
		newMsg["room_name"] = args.room_name;
		newMsg["timestamp"] = UTCNow();
		Messages.insert(newMsg);
		return true;
	}
});

// App startup
Meteor.startup(function () {
	instachat.unreadMessageSound = new Audio("/sound/Electro_-S_Bainbr-7955.wav");
	$(window).resize();
	$('#nickPickModal').modal({
		keyboard: false,
		backdrop: "static"
	});
	return $('#nickInput').select();
});
