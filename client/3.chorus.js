var Messages, Tasks, gup, hideMessageAlert, instachat, scrollMessagesView, showUnreadMessagesAlert, unreadMessage;

Tasks = new Meteor.Collection("tasks");
Messages = new Meteor.Collection("messages");

// Params
var staleTime = 100000;

// Collection Subscriptions
Meteor.subscribe("tasks");

// App startup
Meteor.startup(function () {

    instachat.unreadMessageSound = new Audio("/sound/Electro_-S_Bainbr-7955.wav");
    $(window).resize();

    var task_name = Session.get("task");
    var task = Tasks.findOne({
        task: task_name
    });
    if (!task) {
        Tasks.insert({
            name: task_name
        });
    }

    scrollMessagesView();
    $("#messageInput").select();

    Session.set("role", (gup("role") || "crowd"));
    Session.set("part", (gup("part") || "c"));
    Session.set("task", (gup("task") || "testing"));
    Session.set("assignmentId", (gup("assignmentId") || ""));
    Session.set("hitId", (gup("hitId") || ""));
    Session.set("turkSubmitTo", (gup("turkSubmitTo") || ""));
    Session.set("min", (gup("min") || ""));

    if (Session.get("role") === "requester") {
        $('#nickPickModal').modal({
            keyboard: false,
            backdrop: "static"
        });
        $('#nickInput').focus();  // Focus on the modal's textbox
    } else {
        Session.set("workerId", (gup("workerId") || Random.id()));
        Meteor.call("newMessage", {
            system: true,
            body: Session.get("workerId") + " just joined the room.",
            task: Session.get("task"),
            role: Session.get("role")
        });
        history.pushState(null, null, "/tasks?role=" + Session.get("role") + "&part=" + Session.get("part") + "&task=" +
            Session.get("task") + "&workerId=" + Session.get("workerId") + "&assignmentId=" +
            Session.get("assignmentId") + "&hitId=" + Session.get("hitId") + "&turkSubmitTo=" +
            Session.get("turkSubmitTo") + "&min=" + Session.get("min"));

        $('#messageInput').focus();
    }
});

// Globals
instachat = {};
instachat.alertWhenUnreadMessages = false;
instachat.messageAlertInterval = null;
instachat.unreadMessages = 0;

Deps.autorun(function () {
    var task_name, role;
    task_name = Session.get("task");
    if (task_name) {
        return Meteor.subscribe(Session.get("role"), task_name);
    }
});

Deps.autorun(function () {
    return Messages.find({
        task: Session.get("task")
    }).observe({
            added: function (item) {
                scrollMessagesView();
                if (!item.system) {
                    return unreadMessage(item);
                }
            }
        });
});

// Utility functions
gup = function (name) {
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.href);
    if(results == null)
        return "";
    else
        return unescape(results[1]);
};

scrollMessagesView = function () {
    return setTimeout(function () {
        return $("#messagesInner").scrollTop(10000);
    }, 200);
};

// Template Binding//
Template.messages.messages = function () {
    return Messages.find({}, {sort: {timestamp: 1}});
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

Template.messages.role = function () {
    //todo: if message is successful display as it's class as if it were a requester's message to distinguish it as successful to workers
    return this.role;
};

Template.messages.votable = function () {
    return Session.get("role") === "crowd" &&
        this.role === "crowd" &&
        Session.get("workerId") !== this.workerId &&
        !this.successful;
};

Template.messages.voted = function () {
    if (this.votedIds) {
        var id = Session.get("workerId");
        return this.votedIds.some(function(e) { return id === e; }) ? (function() { return "unvote"; })() : (function() { return "vote"; })();
    }
    return "vote";
};

Template.messages.id = function() {
    return this._id;
};

Template.messages.events = {
    "click button": function (e, template) {
        Meteor.call($(e.currentTarget).val(), [this._id, Session.get("workerId")]);
    }
};

Template.messages.isStale = function(msgTime) {
    return (new Date).getTime() > (msgTime + staleTime);  // Classify prior messages older than 200s as stale
};

Template.messages.onlineCount = function() {
    return Meteor.users.find({ "status.online": true }).count()
}

Template.muteButton.volumeIcon = function () {
    if (Session.get("mute")) {
        return "icon-volume-off";
    } else {
        return "icon-volume-up";
    }
};

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
    if (!(doc["nick"] === Session.get("workerId") || Session.get("mute"))) {
        instachat.unreadMessageSound.play();
    }
    if (instachat.alertWhenUnreadMessages) {
        instachat.unreadMessages += 1;
        return showUnreadMessagesAlert();
    }
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

$("#messageForm").live("submit", function (e) {
    var $message, message;
    $message = $("#messageInput");
    message = $message.val();
    $message.val("");
    if (message) {
        Meteor.call('newMessage', {
            workerId: Session.get("workerId"),
            body: message,
            task: Session.get("task"),
            role: Session.get("role")
        });
    }
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
        $.cookie("workerId", nick, {
            expires: 365
        });
        Session.set("workerId", nick);
        $('#nickPickModal').modal('hide');
    }
    Meteor.call("newMessage", {
        system: true,
        body: Session.get("workerId") + " just joined the room.",
        task: Session.get("task"),
        role: Session.get("role")
    });
    history.pushState(null, null, "/tasks?role=" + Session.get("role") + "&part=" + Session.get("part") + "&task=" +
        Session.get("task") + "&workerId=" + Session.get("workerId") + "&assignmentId=" + Session.get("assignmentId") +
        "&hitId=" + Session.get("hitId") + "&turkSubmitTo=" + Session.get("turkSubmitTo") + "&min=" +
        Session.get("min"));
    hideMessageAlert();

    $('#messageInput').focus();
    return false;
});


function checkMessages() {
    $('.messageRow').each( function() {
        if( !$(this).hasClass('stale') ) {
            if( parseInt($(this).attr('timestamp')) + staleTime < new Date().getTime() ) {
                $(this).addClass('stale');
                $(this).children('.timestamp').addClass('stale');
                $(this).children('button').remove();
            }
        }
    });
}

// Timer callbacks

var shortTimerHandle = setInterval( function() {
    checkMessages();
}, 5000);



// Main //
$(document).ready( function() {
    // On-start
});
