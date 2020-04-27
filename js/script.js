let socket = null;
var app = new Vue({
el: '#app',
data: {
    version: '1.2.4',
    hostSocketId: 0,
    isHost: false,
    roomName: '',
    usersInLobby: [],
    users: [],
    username: '',
    player: {},
    gameCreated: false,

    state: 5,
    createState: 0,

    gameCreator: false,
    gameData: {},
    isGameMaker: false,
    creatorData: {},
    hostAdvanced: false,

    hasVoted: false,
    startingPlayer: 0,

    ghostsRemaining: 0,
    playersLeft: 0,
    neededVotes: 0,

    ghostsWin: false,
    playersWin: false,
    kickedPlayerName: '',
    ghostsGuessed: 0,
    totalGuessed: 0,
},
// -----------------------------------------------------------APPLICATION OPENING FUNCTIONS---------------------------------------------------------------------
created: function () {
    // Current server that we are connecting to
    socket = io('ws://ghostsonline.me:8081');
    if (window.location.search !== '') {
        let room = window.location.search.toString();
        room = room.toUpperCase();
        room = room.slice(1);
        console.log(room)
        socket.emit('joinRoom', room);
    }
    console.log(window.location);
},
// -----------------------------------------------------------SOCKET LISTENER FUNCTIONS---------------------------------------------------------------------
mounted: function () {
    // -------------------Room socket functions----------------------------
    socket.on('createRoom', function (obj) {
        console.log('Created room: ' + obj.room);
        app.isHost = true;
        app.hostSocketId = socket.id;
        app.roomName = obj.room;
        app.state = 6
    })
    socket.on('joinRoom', function (obj) {
        if (app.isHost) {
            app.updateInformation();
        }
        console.log(app.gameData);
        if (obj.id === socket.id) {
            console.log('Joined room: ' + obj.room);
            app.roomName = obj.room
            app.state = 0;
        }
    })
    socket.on('noRoom', function (name) {
        alert('No room with key: ' + name);
    })
    socket.on('join', function (user) {
        console.log('pushing to users')
        app.users.push(user);
        app.usersInLobby.push(user);
        console.log(app.usersInLobby);
        if (app.isGameMaker) {
            app.creatorData.users = app.users;
            console.log("SENDING Creator DATA");
            socket.emit('gameData', app.creatorData);
        }
    })
    socket.on('playerJoin', function (user) {
        // Gets the indv player array set up
        if (user.socketid === socket.id) {
            console.log('Getting individual data for player');
            app.player = user;
            console.log(app.player)
        }
    })
    // -------------------Leaving socket functions----------------------------
    socket.on('hostDisconnected', function () {
        alert("Host has disconnected. Returning to main menu.")
        app.state = 5;
        socket.emit('everyoneLeave', app.roomName);
    })
    socket.on('leaveRoom', function (id) {
        console.log("User has left the room");
        let indexToLeave = -1;
        for (let i = 0; i < app.users.length; ++i) {
            if (app.users[i].socketid === id) {
                indexToLeave = i;
            }
        }
        if (indexToLeave !== -1) {
            app.users.splice(indexToLeave, 1);
            app.updateInformation();
        }
    })
    socket.on('hostLeft', function (obj) {
        console.log("Host left. Returning to menu")
        alert("Host has left the game. Going to main menu.")
        app.state = 5;
    })

    // -------------------Game creating socket functions----------------------------
    socket.on('deleteGame', function (obj) {
        app.users = obj.users;
        app.gameData = {}
    })
    socket.on('start', function (startObj) {
        // starts the game and changes state for everyone
        console.log('Starting Game');
        app.state = 2;
        app.ghostsRemaining = parseInt(startObj.ghostCount);
        app.playersLeft = parseInt(startObj.playersLeft);
        app.neededVotes = app.playersLeft + app.ghostsRemaining
        app.neededVotes /= 2
        app.neededVotes = Math.floor(app.neededVotes)
        app.neededVotes += 1
    })
    socket.on('gameData', function (data) {
        // Gets all the game data to the users
        console.log('Gathering all of the gameData');
        app.users = data.users;
        app.gameData = data;
        let wordList = data.words;
        app.gameCreated = true;
        for (let i = 0; i < app.users.length; ++i) {
            // Add word to users array
            app.users[i].word = wordList[0];
            if (app.users[i].word === "ghost") {
                app.users[i].isGhost = true;
            } else {
                app.users[i].isGhost = false;
            }
            wordList.splice(0,1);
        }
        for (let i = 0; i < app.users.length; ++i) {
            if (app.users[i].id === app.player.id) {
                app.player.word = app.users[i].word;
                app.player.isGhost = app.users[i].isGhost;
            }
        }
    })
    socket.on('updateInformation', function (obj) {
        app.roomName = obj.roomName;
        app.usersInLobby = obj.usersInLobby;
        app.users = obj.users;
        app.gameData = obj.gameData;
        app.ghostsRemaining = obj.ghostsRemaining;
        app.playersLeft = obj.playersLeft;
        app.neededVotes = obj.neededVotes;
    })
    // -------------------Ghost stage socket functions----------------------------
    socket.on('startingPlayer', function (index) {
        // starts the game and changes state for everyone
        console.log('Starting player is index ' + index);
        app.startingPlayer = parseInt(index)
        app.player.votedIndex = -1;
        for (let i = 0; i < app.users.length; ++i) {
            app.users[i].votes = 0;
            app.users[i].votedIndex = -1;
        }
        app.hasVoted = false;

        // Add user temporarily for dont vote
        var dontVote = {            
            'socketid': 0,
            'name': 'Nobody',
            'id': -1, 
            'word': 'SHOW MERCY',
            'isGhost': false,
            'votes': 0,
            'isKicked': false,
            'hasGuessed': false,
            'guess': '',
            'votedIndex': -1,
        }
        app.users.push(dontVote);
        app.state = 3;
    })

    // -------------------Player stage socket functions----------------------------
    socket.on('startVote', function (voteObj) {
        // updates the voting for ghosts
        console.log("updating votes for everyone")
        app.users[parseInt(voteObj.index)].votes = parseInt(voteObj.votes)
        for (let i = 0; i < app.users.length; ++i) {
            if (app.users[i].socketid === voteObj.player) {
                if(voteObj.isPlus) {
                    app.users[i].votedIndex = voteObj.index;
                } else {
                    app.users[i].votedIndex = -1;
                }
            }
        }
    })
    socket.on('startKick', function (voteObj) {
        // updates the voting for kicking
        console.log("updating votes for everyone to kick")
        app.users[parseInt(voteObj.index)].votes = parseInt(voteObj.votes)
        for (let i = 0; i < app.users.length; ++i) {
            if (app.users[i].socketid === voteObj.player) {
                if(voteObj.isPlus) {
                    app.users[i].votedIndex = voteObj.index;
                } else {
                    app.users[i].votedIndex = -1;
                }
            }
        }
    })

    // ------------------Result stage socket functions----------------------------
    socket.on('ghostGuessed', function (guess) {
        console.log("A Ghost has guessed");
        console.log(guess)
        app.totalGuessed += 1;
        if (guess === app.gameData.topic) {
            app.ghostsGuessed = 1;
        }
        else if (app.totalGuessed >= app.gameData.ghostCount) {
            app.ghostsGuessed = 2;
        }
    })
    socket.on('result', function (index) {
        // Goes to result screen after player is kicked
        console.log('Gathering results from kicked player: ' + index);
        app.player.votedIndex = -1;
        let isNobody = false;
        let nobodyIndex = parseInt(app.users.length - 1);
        for (let i = 0; i < app.users.length; ++i) {
            app.users[i].votes = 0;
            app.users[i].votedIndex = -1;
        }
        if (index == nobodyIndex) {
            isNobody = true;
        }
        console.log(index);
        console.log(nobodyIndex)
        console.log(app.users)
        app.hasVoted = false;
        // Delete user from array
        if (app.users[index].isGhost && !isNobody) {
            app.ghostsRemaining -= 1;
        } 
        else if (!app.users[index].isGhost && !isNobody) {
            console.log("in playersleft")
            app.playersLeft -= 1;
        }
        app.state = 4;
        app.kickedPlayerName = app.users[index].name
        console.log("kicked " + app.kickedPlayerName + " at index: " + index);
        console.log(app.users);
        // Check to see if game is won 
        if (app.ghostsRemaining >= app.playersLeft) {
            app.ghostsWin = true;
            app.isGameMaker = false;
        } else if (app.ghostsRemaining === 0) {
            app.playersWin = true;
            app.isGameMaker = false;
        }
        // Reset variables
        app.neededVotes = app.playersLeft + app.ghostsRemaining
        app.neededVotes /= 2
        app.neededVotes = Math.floor(app.neededVotes)
        app.neededVotes += 1
        console.log(app.player)
        if (app.player.name === app.kickedPlayerName) {
            console.log("Tell player he has been kicked and stop action")
            app.player.isKicked = true;
        }
        if (!isNobody) {
            app.users.splice(nobodyIndex, 1);
        }
        app.users.splice(index, 1);
        if (!app.ghostsWin && !app.playersWin) {
            setTimeout(function() {
                console.log("Starting next round...");
                app.state = 2;
            }, 5000);
        }
    })
    socket.on('return', function () {
        app.users = app.usersInLobby;
        app.player.isKicked = false;
        app.ghostsWin = false;
        app.playersWin = false;
        app.hostAdvanced = false;
        app.state = 1;
        app.ghostsGuessed = 0;
        app.totalGuessed = 0;
        app.gameCreated = false;
    })
    // ------------------Host socket functions----------------------------
    socket.on('advance', function () {
        console.log("Host advancing round");
        for (let i = 0; i < app.users.length; ++i) {
            app.users[i].votes = 0;
            app.users[i].votedIndex = -1;
        }

        let nobodyIndex = parseInt(app.users.length - 1);
        app.users.splice(nobodyIndex, 1);

        app.hostAdvanced = true;
        app.hasVoted = false;
        app.state = 4;
        setTimeout(function() {
            console.log("Starting next round...");
            app.state = 2;
            app.hostAdvanced = false;
        }, 5000);
    })
},

// -----------------------------------------------------------METHODS---------------------------------------------------------------------
methods: {

    // -------------------Room socket functions-------------------------------

    createRoom() {
        this.roomName = Math.random().toString(36).substring(7);
        this.roomName = this.roomName.toUpperCase();
        socket.emit('createRoom', this.roomName);
    },
    joinRoom() {
        if (this.roomName === '') {
            alert('please enter valid room name')
        } else {
            this.roomName = this.roomName.toUpperCase();
            socket.emit('joinRoom', this.roomName);
        }
    },
    setUsername: function () {
        // Sets the username of the user and sends to server
        console.log("Setting username")
        if (this.username === '') {
            alert('Please type in a valid username.');
        } else {
            let obj = {
                'username': this.username,
                'roomName': this.roomName,
            }
            socket.emit('join', obj);
            this.username = '';
            this.state = 1;
        }
    },

    // -------------------Leaving socket functions----------------------------

    leaveRoom() {
        console.log("Leaving the room.");
        let obj = {
            'room': this.roomName,
            'isHost': this.isHost,
            'socketid': socket.id
        }
        app.state = 5;
        socket.emit('leaveRoom', obj);
    },
    backButtonUser() {
        console.log('user leaving joined game.')
        this.state = 5;
        socket.emit('leaveRoom', this.roomName);
    },

    // -------------------Game creating socket functions----------------------------

    deleteGame() {
        console.log('deleting game sent');
        this.createState = 0;
        this.isGameMaker = 0;
        this.gameCreated = false;
        var obj = {
            'users': this.usersInLobby,
            'roomName': this.roomName,
        }
        socket.emit('deleteGame', obj);
    },
    updateInformation() {
        console.log("Updating info for all users");
        let obj = {
            'roomName': this.roomName,
            'usersInLobby': this.usersInLobby,
            'users': this.users,
            'gameData': this.gameData,
            'ghostsRemaining': this.ghostsRemaining,
            'playersLeft': this.playersLeft,
            'neededVotes': this.neededVotes,
            'hostSocketId': this.hostSocketId
        }
        socket.emit('updateInformation', obj);
    },
    createGamePart1: function () {
        // Creates array for game words and changes state
        console.log("Creating Game data part 1");
        this.gameData.words = []
        this.createState = 1
    },
    createGamePart2: function () {
        // Gets all of the words in an array and sends to server
        console.log("Creating Game data part 2");
        // Gets the game maker out of the game
        this.isGameMaker = true;
        for (let i = 0; i < this.users.length; ++i) {
            if (this.users[i].socketid === socket.id) {
                this.users.splice(i, 1);
            }
        }
        if (this.player.socketid === socket.id) {
            this.player.isGhost = true;
        }
        this.gameData.playerCount = parseInt(this.gameData.topicCount) + parseInt(this.gameData.subtopicCount);
        if (this.gameData.words.length !== this.gameData.playerCount) {
            alert("Please fill out all the boxes first")
        }
        else {
            for (let i = 0; i < parseInt(this.gameData.ghostCount); ++i) {
                this.gameData.words.push('ghost');
            }
            this.gameData.playerCount += parseInt(this.gameData.ghostCount)
            this.createState = 2;
            this.gameCreator = false;
            this.gameData.roomName = this.roomName;
            this.gameData.users = this.users;
            this.gameData.topic = this.gameData.words[0].toLowerCase();
            this.creatorData = this.gameData;
            socket.emit('gameData', this.gameData);
            alert("Success! Game was sent to server!");
        }
    },
    startGame: function () {
        // starts the game and sends to server
        console.log('Starting game startgame function')
        if (this.users.length === this.gameData.playerCount) {
            this.state = 2
            this.gameCreator = false;
            this.createState = 0;
            let startObj = {
                'ghostCount': this.gameData.ghostCount,
                'playersLeft': (this.gameData.playerCount - this.gameData.ghostCount),
                'roomName': this.roomName
            }
            socket.emit('start', startObj);
        } else {
            alert("Your game requires that you have " + this.gameData.playerCount.toString() + ' players.')
        }
    },
    backButtonGameCreator() {
        if (this.createState > 0) {
            this.createState -=1;
        }else {
            this.gameCreator = false; 
        }
    },

    // -------------------Ghost stage socket functions----------------------------

    voteForStart(index) {
        // Ghosts vote for who should go first
        console.log("vote for " + index)
        this.player.votedIndex = index;
        if (!this.hasVoted) {
            this.users[index].votes += 1;
            this.hasVoted = true;
            let voteObj = {
                'index': index,
                'votes': this.users[index].votes,
                'roomName': this.roomName,
                'player': this.player.socketid,
                'isPlus': true,
            }
            socket.emit('startVote', voteObj)
        }
        if (this.users[index].votes >= this.ghostsRemaining) {
            console.log("Finalized a starting player")
            let obj = {
                'index': index,
                'roomName': this.roomName
            }
            setTimeout(function() {
                socket.emit('startingPlayer', obj);
            }, 1000);
        }
    },
    unvoteForStart(index) {
        // Ghosts unvote for who should go first
        console.log("unvote for " + index)
        this.player.votedIndex = -1;
        if (this.hasVoted) {
            this.users[index].votes -= 1;
            this.hasVoted = false;
            let voteObj = {
                'index': index,
                'votes': this.users[index].votes,
                'roomName': this.roomName,
                'player': this.player.socketid,
                'isPlus': false,
            }
            socket.emit('startVote', voteObj)
        }
    },

    // -------------------Player stage socket functions----------------------------

    voteForKick(index) {
        // Players voting for player to kick
        console.log("vote to kick " + index)
        this.player.votedIndex = index;
        if (!this.hasVoted) {
            this.users[index].votes += 1;
            this.hasVoted = true;
            let voteObj = {
                'index': index,
                'votes': this.users[index].votes,
                'roomName': this.roomName,
                'player': this.player.socketid,
                'isPlus': true,
            }
            socket.emit('startKick', voteObj)
        }
        if (this.users[index].votes >= this.neededVotes) {
            console.log("Finalized a kicked player")
            let obj = {
                'index': index,
                'roomName': this.roomName
            }
            setTimeout(function() {
                socket.emit('result', obj);
            }, 1000);
        }
    },
    unvoteForKick(index) {
        console.log("unvote for " + index)
        this.player.votedIndex = -1;
        if (this.hasVoted) {
            this.users[index].votes -= 1;
            this.hasVoted = false;
            let voteObj = {
                'index': index,
                'votes': this.users[index].votes,
                'roomName': this.roomName,
                'player': this.player.socketid,
                'isPlus': false,
            }
            socket.emit('startKick', voteObj)
        }
    },

    // ------------------Result stage socket functions----------------------------

    guessTopic() {
        console.log(this.player.guess)
        this.player.hasGuessed = true;
        if (this.player.guess === app.gameData.topic) {
            app.ghostsGuessed = 1;
        }
        let obj = {
            'guess': this.player.guess.toLowerCase(),
            'room': this.roomName,
        }
        socket.emit('ghostGuessed', obj);
    },
    returnToLobby() {
        console.log("player is returning to lobby");
        socket.emit('return', this.roomName);
    },

    // ------------------Host socket functions----------------------------

    advance() {
        console.log("host is advancing");
        socket.emit('advance', this.roomName)
    },
    backButtonHost() {
        console.log('host destroying made game.')
        this.state = 5;
        socket.emit('everyoneLeave', this.roomName);
    }
}
});