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
    return Messages.find({
        task: task,
        role: {
            $in: ["admin", "crowd", "requester"]
        }
    }, {
        sort: {timestamp: -1},
        limit: 150
    });
});

Meteor.publish("crowd", function (task) {
    return Messages.find({
        task: task,
        role: {
            $in: ["crowd", "requester"]
        }
    }, {
        sort: {timestamp: -1},
        limit: 150
    });
});

Meteor.publish("requester", function (task) {
    return Messages.find({
        $or:
            [{
                task: task,
                role: "requester"
            },
                {
                    successful: true
                }]
    }, {
        sort: {timestamp: -1},
        limit: 150
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
        if ((args.role === "crowd") && (args.system !== true)) {
            newMsg["voteThreshold"] = (function () {
                var observers = Meteor._RemoteCollectionDriver.mongo._liveResultsSets['{"ordered":false,"collectionName":"messages","selector":{"task":"' + args.task +  '","role":{"$in":["crowd","requester"]}},"options":{"transform":null,"sort":{"timestamp":-1},"limit":150}}']._observeHandles,
                    count = Object.keys(observers).length;
                return count/3;
            })();
        }
        newMsg["task"] = args.task;
        newMsg["role"] = args.role;
        newMsg["timestamp"] = UTCNow();

        Messages.insert(newMsg);
        return true;
    },
    vote: function (id) {
        var message = Messages.findOne(id);

        if (message.votes >= (message.voteThreshold)) {
            Messages.update(id, {$inc: {votes: 1}, $set: {successful: true}});
        } else {
            Messages.update(id, {$inc: {votes: 1}});
        }
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