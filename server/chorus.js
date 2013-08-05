var Messages, Tasks, UTCNow;

// Tasks - {name: string}
Tasks = new Meteor.Collection("tasks");

// Messages - {message:    String
//             username:   String
//             task:       String
//             created_at: Number}
Meteor.publish("tasks", function () {
    return Tasks.find();
});

Messages = new Meteor.Collection("messages");

Meteor.publish("admin", function (task) {
    var count, skip;
    count = Messages.find({
        task: task,
        role: {
            $in: ["admin", "crowd", "requester"]
        }
    }).count();
    // WSL TODO: What is this? Why do we want to skip anything over 150 messages?
    skip = count > 150 ? count - 150 : 0;
    return Messages.find({
        task: task,
        role: {
            $in: ["admin", "crowd", "requester"]
        }
    }, {
        skip: skip
    });
});

Meteor.publish("crowd", function (task) {
    var count, skip;
    count = Messages.find({
        task: task,
        role: {
            $in: ["crowd", "requester"]
        }
    }).count();
    skip = count > 150 ? count - 150 : 0;
    return Messages.find({
        task: task,
        role: {
            $in: ["crowd", "requester"]
        }
    }, {
        skip: skip
    });
});

Meteor.publish("requester", function (task) {
    var count, skip;
    count = Messages.find({
        $or:
            [{
                task: task,
                role: "requester"
            },
                {
                    votes: {$gt: 4}
                }]
    }).count();
    skip = count > 150 ? count - 150 : 0;
    return Messages.find({
        $or:
            [{
                task: task,
                role: "requester"
            },
                {
                    votes: {$gt: 4}
                }]
    }, {
        skip: skip
    });
});

UTCNow = function () {
    var now;
    now = new Date();
    return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
};

Meteor.methods({
    newMessage: function (args) {
        var newMsg;
        newMsg = {};
        newMsg["body"] = args.body;
        if (args.workerId) {
            newMsg["workerId"] = args.workerId;
        }
        if (args.system) {
            newMsg["system"] = args.system;
        }
        newMsg["task"] = args.task;
        newMsg["role"] = args.role;
        newMsg["timestamp"] = UTCNow();

        Messages.insert(newMsg);
        return true;
    },
    vote: function (id) {
        Messages.update(id, {$inc: {votes: 1}});
    }
});

Meteor.startup(function () {
    // remove all update/remove access from the client
    return _.each(["Tasks", "Messages"], function (collection) {
        return _.each(["update", "remove"], function (method) {
            return Meteor.default_server.method_handlers["/" + collection + "/" + method] = function () {};
        });
    });
});