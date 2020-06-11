const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { v4: uuidv4 } = require('uuid');


const checkInterval = 3000;
const polls = {};

class Poll {
    constructor(name, options = []) {
        if(name && options) {
            this.id = uuidv4();
            this.name = name;
            this.options = options.map(name => ({
                id: uuidv4(),
                name,
                votes: 0,
                color: this.randomColor
            }));
            this.running = true;

        }
    }

    get randomColor() {
        var letters = '0123456789ABCDEF';
        var color = '#';
        for (var i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    getData() {
        return {
            id: this.id,
            name: this.name,
            total: this.totalVotes,
            options: this.options.map(option => {
                const percent = this.toPercent(option.votes, this.totalVotes);
                return {
                    ...option,
                    percentage: percent,
                    readable_percentage: Math.floor(percent) 
                }
            }),
            running: this.running
        }
    }

    toPercent(num, total) {
        if(num > 0) {
            return ((num / total) * 100).toFixed(2);
        } else {
            return 0;
        }
    }

    get totalVotes() {
        let total = 0;
        this.options.forEach(option => {
            total += option.votes;
        });
        
        return total;
    }

    vote(option_id) {
        this.options.forEach(option => {
            if(option_id === option.id) {
                option.votes++;
            }
        })
    }
};




io.on('connection', (socket) => {
    socket.on('create poll', data => {
        const poll = new Poll(data.name, data.options);
        polls[poll.id] = poll;
        socket.leaveAll();
        socket.join(poll.id);
        socket.emit('created poll', poll.getData());
    });

    socket.on('get poll', id => {
        const poll = polls[id];
        if(poll) {
            socket.leaveAll();
            socket.join(poll.id);
            socket.emit('updated poll', poll.getData());
        } else {
            socket.emit('error poll', "This poll doesn't exist.")
        }
    })

    socket.on('get polls', () => {
        socket.emit('loaded polls', polls);
    });

    socket.on('vote poll', data => {
        if(data.poll_id && data.option_id) {
            const poll = polls[data.poll_id];

            if(poll) {
                poll.vote(data.option_id);
                io.to(poll.id).emit('updated poll', poll.getData());
            }
        }
    })
});


app.get("/", express.static(__dirname + '/public'));

http.listen(3000, () => {
    console.log('listening on *:3000');
});