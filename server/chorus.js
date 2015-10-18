var Messages, Tasks;

// Tasks - {name: string}
Tasks = new Meteor.Collection("tasks");

// Params
maxCount = 150;

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
        limit: maxCount
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
        limit: maxCount
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
        limit: maxCount
    });
});

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
                var observers = Meteor._RemoteCollectionDriver.mongo._liveResultsSets['{"ordered":false,"collectionName":"messages","selector":{"task":"' + args.task +  '","role":{"$in":["crowd","requester"]}},"options":{"transform":null,"sort":{"timestamp":-1},"limit":150}}']._observeHandles;
                var count = Object.keys(observers).length;
                if( count < 3 ) {
                    Messages.update(args.id, {$set: {successful: true}});
                    newMsg["successful"] = true;
                }
console.log('COUNT: ', count, count/3);
                return count/3;
            })();
            newMsg["votedIds"] = [ args.workerId ];
            newMsg["votes"] = 1;

        }

        newMsg["task"] = args.task;
        newMsg["timestamp"] = new Date().getTime();

        newMsg["role"] = args.role;
        if( args.role == "requester" ) {
            newMsg["successful"] = true;
        }

        Messages.insert(newMsg);
        return true;
    },
    vote: function (params) {
        var id = params[0];
        var workerId = params[1];
        var message = Messages.findOne(id);

        Messages.update(id, {$inc: {votes: 1}, $addToSet: { votedIds: workerId}});
        if (message.votes >= (message.voteThreshold)) {
            Messages.update(id, {$set: {successful: true}});
            // TODO: show 'accepted'
        }
    },
    unvote: function(params) {
        var id = params[0];
        var workerId = params[1];
        var message = Messages.findOne(id);
        if (!message.successful) {
            Messages.update(id, {$inc: {votes: -1}, $pull: { votedIds: workerId}});
        }
    }
});

Meteor.startup(function () {
    process.env.HTTP_FORWARDED_COUNT = 0;
    // remove all update/remove access from the client
    return _.each(["Tasks", "Messages"], function (collection) {
        return _.each(["update", "remove"], function (method) {
            return Meteor.default_server.method_handlers["/" + collection + "/" + method] = function () {};
        });
    });
});

