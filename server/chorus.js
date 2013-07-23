var Messages, Rooms, UTCNow;

// Rooms - {name: string}
Rooms = new Meteor.Collection("rooms");

// Messages - {message:   String
//             username:  String
//             room_id:   String
//             created_at: Number}
Meteor.publish('rooms', function () {
	return Rooms.find();
});

Messages = new Meteor.Collection("messages");

Meteor.publish('messages', function (room_name) {
	var count, skip;
	count = Messages.find({
		room_name: room_name
	}).count();
	// WSL TODO: What is this? Why do we want to skip anything over 150 messages?
	skip = count > 150 ? count - 150 : 0;
	//console.log("HERE:" + room_name + " || " + count);
	//console.log(Messages.find({ room_name: room_name }));
	return Messages.find({
		room_name: room_name
	}, {
		skip: skip
	});
});

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

UTCNow = function () {
	var now;
	now = new Date();
	return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
};

Meteor.startup(function () {
	// remove all update/remove access from the client
	return _.each(['Rooms', 'Messages'], function (collection) {
		return _.each(['update', 'remove'], function (method) {
			return Meteor.default_server.method_handlers['/' + collection + '/' + method] = function () {};
		});
	});
});
