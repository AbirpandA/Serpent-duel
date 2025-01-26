const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d');
        const startScreen = document.getElementById('start-screen');
        const gameOverScreen = document.getElementById('game-over-screen');
        const gameOverMessage = document.getElementById('game-over-message');

        // Constants
        const GRID_SIZE = 10;
        const POWERUP_DURATION = 5000; // 5 seconds for most power-ups
        const REVERSE_DURATION = 2000; // Changed from 2500 to 2000 (2 seconds) for reverse power-up
        const POWERUP_INTERVAL = 10000; // 10 seconds

        // Game States
        const GAME_STATES = {
            MENU: 'menu',
            PLAYING: 'playing',
            PAUSED: 'paused',
            GAME_OVER: 'gameOver'
        };

        class GameStateManager {
            constructor() {
                this.states = new Map();
                this.currentState = null;
            }

            addState(name, state) {
                this.states.set(name, state);
            }

            transition(newState) {
                if (this.currentState) this.currentState.exit();
                this.currentState = this.states.get(newState);
                this.currentState.enter();
            }
        }

        // Event System
        class EventSystem {
            constructor() {
                this.events = {};
            }

            on(eventName, callback) {
                if (!this.events[eventName]) {
                    this.events[eventName] = [];
                }
                this.events[eventName].push(callback);
            }

            emit(eventName, data) {
                if (this.events[eventName]) {
                    this.events[eventName].forEach(callback => callback(data));
                }
            }
        }

        // Tutorial System
        class TutorialSystem {
            constructor() {
                this.steps = [
                    {
                        message: "Use WASD to move your snake",
                        condition: () => true
                    },
                    {
                        message: "Collect food to grow longer",
                        condition: () => game.scores.player > 0
                    },
                    {
                        message: "Power-ups give special abilities",
                        condition: () => game.powerUps.length > 0
                    }
                ];
                this.currentStep = 0;
            }

            update() {
                if (this.currentStep < this.steps.length) {
                    if (this.steps[this.currentStep].condition()) {
                        this.showMessage(this.steps[this.currentStep].message);
                        this.currentStep++;
                    }
                }
            }
        }

        class Snake {
            constructor(color, borderColor, startX, startY, isAI = false, difficulty = 1) {
                this.body = [{ x: startX, y: startY }];
                this.color = color;
                this.borderColor = borderColor;
                this.direction = { x: 1, y: 0 };
                this.isAI = isAI;
                this.moveCounter = 0;
                this.originalSpeed = 7;  // Changed from 5 to 7 (higher number = slower speed)
                this.moveInterval = this.originalSpeed;
                this.powerUp = null;
                this.powerUpTimer = null;
                this.combo = 0;
                this.comboTimer = null;
                this.difficulty = difficulty; // AI difficulty level (1-5)
                this.isShielded = false;
                this.isGhost = false;
                this.isReversed = false;
                this.originalLength = 3;
                this.isFrozen = false;
                this.frozenSpeed = this.originalSpeed * 2; // Half speed when frozen
                this.parent = null; // Reference to parent snake for clones
                this.isClone = false;
                this.isDashing = false;
                this.dashDistance = 2; // Shorter dash for better stability
            }

            activatePowerUp(type) {
                this.powerUp = type;
                const otherSnake = this === game.snake1 ? game.snake2 : game.snake1;
                
                switch(type) {
                    case 'speed':
                        this.moveInterval = Math.floor(this.originalSpeed / 1.25);
                        break;
                    case 'shield':
                        this.isShielded = true;
                        break;
                    case 'ghost':
                        this.isGhost = true;
                        break;
                    case 'reverse':
                        otherSnake.isReversed = true;
                        otherSnake.lastDirection = { ...otherSnake.direction };
                        otherSnake.direction.x *= -1;
                        otherSnake.direction.y *= -1;
                        
                        setTimeout(() => {
                            otherSnake.isReversed = false;
                            if (otherSnake.isAI) {
                                otherSnake.direction = { ...otherSnake.lastDirection };
                            }
                        }, REVERSE_DURATION);
                        break;
                    case 'freeze':
                        otherSnake.isFrozen = true;
                        otherSnake.moveInterval = otherSnake.frozenSpeed;
                        setTimeout(() => {
                            otherSnake.isFrozen = false;
                            otherSnake.moveInterval = otherSnake.originalSpeed;
                        }, POWERUP_DURATION);
                        break;
                    case 'growth':
                        // Growth effect is handled in checkFoodCollision
                        break;
                }

                if (this.powerUpTimer) clearTimeout(this.powerUpTimer);
                
                if (['speed', 'shield', 'ghost', 'growth'].includes(type)) {
                    this.powerUpTimer = setTimeout(() => {
                        this.deactivatePowerUp();
                    }, POWERUP_DURATION);
                }
            }

            deactivatePowerUp() {
                this.moveInterval = this.originalSpeed;
                this.isShielded = false;
                this.isGhost = false;
                this.isReversed = false;
                this.powerUp = null;
                if (this.powerUpTimer) {
                    clearTimeout(this.powerUpTimer);
                    this.powerUpTimer = null;
                }
            }

            draw() {
                if (!this.body || !this.body[0]) return;

                this.body.forEach((segment, index) => {
                    if (!segment) return;
                    
                    // Set colors based on power-up state
                    if (this.powerUp) {
                        ctx.fillStyle = this.color + 'cc';  // Semi-transparent base color
                        ctx.strokeStyle = this.getPowerUpColor();
                    } else {
                        ctx.fillStyle = this.color;
                        ctx.strokeStyle = this.borderColor;
                    }

                    if (index === 0) {
                        // Draw head
                        ctx.beginPath();
                        ctx.arc(
                            segment.x * GRID_SIZE + GRID_SIZE / 2, 
                            segment.y * GRID_SIZE + GRID_SIZE / 2, 
                            GRID_SIZE / 2, 0, Math.PI * 2
                        );
                        ctx.fill();
                        ctx.stroke();

                        // Add glow effect for active power-ups
                        if (this.powerUp) {
                            ctx.beginPath();
                            ctx.arc(
                                segment.x * GRID_SIZE + GRID_SIZE / 2, 
                                segment.y * GRID_SIZE + GRID_SIZE / 2, 
                                GRID_SIZE / 1.5, 0, Math.PI * 2
                            );
                            ctx.strokeStyle = this.getPowerUpColor() + '44';  // Transparent glow
                            ctx.lineWidth = 2;
                            ctx.stroke();
                            ctx.lineWidth = 1;
                        }
                    } else {
                        // Draw body segments
                        ctx.fillRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
                        ctx.strokeRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
                    }
                });
            }

            getPowerUpColor() {
                switch(this.powerUp) {
                    case 'speed': return '#fbbf24';
                    case 'shield': return '#60a5fa';
                    case 'ghost': return '#a78bfa';
                    case 'reverse': return '#f59e0b';
                    case 'freeze': return '#38bdf8';
                    case 'growth': return '#22c55e';
                    default: return this.borderColor;
                }
            }

            move(food, otherSnake) {
                if (!this.body || !this.body[0]) return 'self';

                this.moveCounter++;
                if (this.moveCounter % (this.isFrozen ? this.frozenSpeed : this.moveInterval) !== 0) {
                    return false;
                }

                if ((this.isAI || this.isClone) && food) {
                    this.smartAIMove(food, otherSnake);
                }

                let direction = { ...this.direction };
                if (this.isReversed) {
                    direction.x *= -1;
                    direction.y *= -1;
                }

                const head = { 
                    x: this.body[0].x + direction.x, 
                    y: this.body[0].y + direction.y 
                };

                if (!this.isGhost) {
                    if (this.willHitWallOrSelf(head)) {
                        return 'self';
                    }
                } else {
                    if (head.x < 0) head.x = Math.floor(canvas.width / GRID_SIZE) - 1;
                    if (head.x >= canvas.width / GRID_SIZE) head.x = 0;
                    if (head.y < 0) head.y = Math.floor(canvas.height / GRID_SIZE) - 1;
                    if (head.y >= canvas.height / GRID_SIZE) head.y = 0;
                }

                if (!this.isShielded && !this.isGhost && otherSnake) {
                    if (this.willHitSnake(head, otherSnake)) {
                        return 'snake';
                    }
                }

                this.body.unshift(head);
                this.body.pop();
                return false;
            }

            willHitWallOrSelf(head) {
                // Wall collision
                if (
                    head.x < 0 || head.x >= canvas.width / GRID_SIZE ||
                    head.y < 0 || head.y >= canvas.height / GRID_SIZE
                ) return true;

                // Self collision
                for (let i = 1; i < this.body.length; i++) {
                    if (head.x === this.body[i].x && head.y === this.body[i].y) 
                        return true;
                }
                return false;
            }

            willHitSnake(head, otherSnake) {
                return otherSnake && otherSnake.body.some(segment => 
                    head.x === segment.x && head.y === segment.y
                );
            }

            eatOtherSnake(otherSnake) {
                // Add other snake's body segments to this snake
                this.body = [...this.body, ...otherSnake.body];
            }

            smartAIMove(food, otherSnake) {
                if (!this.isAI) return;

                const head = this.body[0];
                const validMoves = this.getValidMoves(otherSnake);
                
                if (validMoves.length === 0) return;

                const distanceToFood = Math.abs(food.x - head.x) + Math.abs(food.y - head.y);
                const distanceToPlayer = Math.abs(otherSnake.body[0].x - head.x) + 
                                        Math.abs(otherSnake.body[0].y - head.y);

                let bestMove = validMoves[0];
                let bestScore = -Infinity;

                validMoves.forEach(move => {
                    const newPos = {
                        x: head.x + move.x,
                        y: head.y + move.y
                    };

                    let score = 0;

                    // Calculate distance to food
                    const newDistanceToFood = Math.abs(food.x - newPos.x) + Math.abs(food.y - newPos.y);
                    
                    // Calculate distance to player
                    const newDistanceToPlayer = Math.abs(otherSnake.body[0].x - newPos.x) + 
                                              Math.abs(otherSnake.body[0].y - newPos.y);

                    // Size advantage calculation
                    const sizeAdvantage = this.body.length - otherSnake.body.length;

                    // Evaluate move based on different factors
                    if (sizeAdvantage >= 2) {
                        // Aggressive behavior only when 2 or more blocks larger
                        score += (distanceToPlayer - newDistanceToPlayer) * 3;
                        score += (distanceToFood - newDistanceToFood);
                    } else if (sizeAdvantage < 0) {
                        // Defensive behavior when smaller
                        score += (newDistanceToPlayer - distanceToPlayer) * 2;
                        score += (distanceToFood - newDistanceToFood) * 3;
                    } else {
                        // Balanced behavior when equal size or only 1 block larger
                        score += (distanceToFood - newDistanceToFood) * 2;
                        score += (newDistanceToPlayer - distanceToPlayer) * 0.5;
                    }

                    // Avoid getting trapped
                    const spacesAvailable = this.countAvailableSpaces(newPos, otherSnake);
                    score += spacesAvailable * 2;

                    // Consider power-ups if nearby
                    const powerUpBonus = this.evaluatePowerUpPosition(newPos, game.powerUps);
                    score += powerUpBonus * 4;

                    // Add some randomness to make behavior less predictable
                    score += Math.random() * this.difficulty;

                    // Survival instinct - avoid corners when not significantly larger
                    if (sizeAdvantage < 2) {
                        const distanceToWall = Math.min(
                            newPos.x,
                            newPos.y,
                            Math.floor(canvas.width / GRID_SIZE) - newPos.x,
                            Math.floor(canvas.height / GRID_SIZE) - newPos.y
                        );
                        score += distanceToWall;
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = move;
                    }
                });

                this.direction = bestMove;
            }

            countAvailableSpaces(pos, otherSnake) {
                let count = 0;
                const visited = new Set();
                const queue = [pos];
                
                while (queue.length > 0 && count < 100) { // Limit search to avoid performance issues
                    const current = queue.shift();
                    const key = `${current.x},${current.y}`;
                    
                    if (visited.has(key)) continue;
                    visited.add(key);
                    count++;

                    const directions = [
                        {x: 1, y: 0}, {x: -1, y: 0},
                        {x: 0, y: 1}, {x: 0, y: -1}
                    ];

                    for (const dir of directions) {
                        const next = {
                            x: current.x + dir.x,
                            y: current.y + dir.y
                        };

                        if (this.isValidPosition(next, otherSnake)) {
                            queue.push(next);
                        }
                    }
                }

                return count;
            }

            isValidPosition(pos, otherSnake) {
                // Check boundaries
                if (pos.x < 0 || pos.x >= canvas.width / GRID_SIZE ||
                    pos.y < 0 || pos.y >= canvas.height / GRID_SIZE) {
                    return false;
                }

                // Check collision with self
                if (this.body.some(segment => segment.x === pos.x && segment.y === pos.y)) {
                    return false;
                }

                // Check collision with other snake
                if (otherSnake.body.some(segment => segment.x === pos.x && segment.y === pos.y)) {
                    return false;
                }

                return true;
            }

            evaluatePowerUpPosition(pos, powerUps) {
                let bonus = 0;
                powerUps.forEach(powerUp => {
                    const distance = Math.abs(powerUp.x - pos.x) + Math.abs(powerUp.y - pos.y);
                    if (distance < 5) { // Only consider nearby power-ups
                        switch(powerUp.type) {
                            case 'speed':
                                bonus += 5 / (distance + 1);
                                break;
                            case 'shield':
                                bonus += 6 / (distance + 1);
                                break;
                            case 'ghost':
                                bonus += 4 / (distance + 1);
                                break;
                            case 'reverse':
                                bonus += 4 / (distance + 1);
                                break;
                            case 'freeze':
                                bonus += 3 / (distance + 1);
                                break;
                        }
                    }
                });
                return bonus;
            }

            getValidMoves(otherSnake) {
                const directions = [
                    { x: 1, y: 0 },
                    { x: -1, y: 0 },
                    { x: 0, y: 1 },
                    { x: 0, y: -1 }
                ];

                return directions.filter(dir => {
                    // Don't allow reversing direction
                    if (dir.x === -this.direction.x && dir.y === -this.direction.y) {
                        return false;
                    }

                    const nextHead = {
                        x: this.body[0].x + dir.x,
                        y: this.body[0].y + dir.y
                    };

                    // Consider ghost mode
                    if (this.isGhost) {
                        if (nextHead.x < 0) nextHead.x = Math.floor(canvas.width / GRID_SIZE) - 1;
                        if (nextHead.x >= canvas.width / GRID_SIZE) nextHead.x = 0;
                        if (nextHead.y < 0) nextHead.y = Math.floor(canvas.height / GRID_SIZE) - 1;
                        if (nextHead.y >= canvas.height / GRID_SIZE) nextHead.y = 0;
                    }

                    // Check wall collision if not in ghost mode
                    if (!this.isGhost && (
                        nextHead.x < 0 || 
                        nextHead.x >= canvas.width / GRID_SIZE || 
                        nextHead.y < 0 || 
                        nextHead.y >= canvas.height / GRID_SIZE
                    )) {
                        return false;
                    }

                    // Check self collision
                    if (this.body.slice(1).some(segment => 
                        segment.x === nextHead.x && segment.y === nextHead.y
                    )) {
                        return false;
                    }

                    // Check other snake collision if not shielded
                    if (!this.isShielded && otherSnake && otherSnake.body.some(segment => 
                        segment.x === nextHead.x && segment.y === nextHead.y
                    )) {
                        return false;
                    }

                    return true;
                });
            }

            grow() {
                const tail = this.body[this.body.length - 1];
                this.body.push({ ...tail });
            }

            checkCollision(otherSnake) {
                const head = this.body[0];
                
                // Wall collision
                if (
                    head.x < 0 || head.x >= canvas.width / GRID_SIZE ||
                    head.y < 0 || head.y >= canvas.height / GRID_SIZE
                ) return true;

                // Self collision
                for (let i = 1; i < this.body.length; i++) {
                    if (head.x === this.body[i].x && head.y === this.body[i].y) 
                        return true;
                }

                // Other snake collision
                return otherSnake.body.some(segment => 
                    head.x === segment.x && head.y === segment.y
                );
            }

            addCombo() {
                this.combo++;
                if (this.comboTimer) clearTimeout(this.comboTimer);
                this.comboTimer = setTimeout(() => this.combo = 0, POWERUP_DURATION);
                return this.combo * 10; // Bonus points
            }

            createClone() {
                const clone = new Snake(
                    this.color,
                    this.borderColor,
                    this.body[0].x,
                    this.body[0].y,
                    true,
                    3
                );
                clone.isClone = true;
                clone.parent = this;
                clone.body = [...this.body];
                clone.expiryTime = Date.now() + POWERUP_DURATION;
                game.cloneSnakes.push(clone);
            }

            performDash() {
                if (!this.body || this.body.length < 1) return;

                const head = this.body[0];
                const newHead = {
                    x: head.x + (this.direction.x * this.dashDistance),
                    y: head.y + (this.direction.y * this.dashDistance)
                };

                // Handle wrapping for ghost mode
                if (this.isGhost) {
                    newHead.x = ((newHead.x % Math.floor(canvas.width / GRID_SIZE)) + Math.floor(canvas.width / GRID_SIZE)) % Math.floor(canvas.width / GRID_SIZE);
                    newHead.y = ((newHead.y % Math.floor(canvas.height / GRID_SIZE)) + Math.floor(canvas.height / GRID_SIZE)) % Math.floor(canvas.height / GRID_SIZE);
                }
                // Check boundaries if not in ghost mode
                else if (
                    newHead.x < 0 || 
                    newHead.x >= Math.floor(canvas.width / GRID_SIZE) ||
                    newHead.y < 0 || 
                    newHead.y >= Math.floor(canvas.height / GRID_SIZE)
                ) {
                    return;
                }

                // Add new head position
                this.body.unshift(newHead);
                // Remove tail segments
                this.body = this.body.slice(0, this.body.length - this.dashDistance);
            }
        }

        class AdvancedAI extends Snake {
            constructor(color, borderColor, startX, startY, difficulty = 3) {
                super(color, borderColor, startX, startY, true, difficulty);
                this.difficulty = difficulty; // 1-5
                this.behaviorState = 'seeking';
                this.targetPosition = null;
                this.dangerThreshold = 3;
                this.pathHistory = [];
                this.stuckCounter = 0;
                this.personalityType = this.generatePersonality();
                
                // New properties for aggressive behavior
                this.aggressionThreshold = 2; // Size advantage needed to become aggressive
                this.huntingRange = 15; // Increased range for hunting player
                this.interceptDistance = 5; // Distance to start intercepting player
                
                // New properties for enhanced power-up awareness
                this.powerUpPriority = 0.8; // High priority for power-ups
                this.powerUpDetectionRange = 10; // Increased detection range
                this.opportunisticRange = 5; // Range to deviate from current path
            }

            generatePersonality() {
                const personalities = {
                    aggressive: {
                        pursuitThreshold: 0.7,
                        powerUpPriority: 0.3,
                        riskTolerance: 0.8
                    },
                    cautious: {
                        pursuitThreshold: 0.3,
                        powerUpPriority: 0.6,
                        riskTolerance: 0.2
                    },
                    balanced: {
                        pursuitThreshold: 0.5,
                        powerUpPriority: 0.5,
                        riskTolerance: 0.5
                    },
                    opportunist: {
                        pursuitThreshold: 0.4,
                        powerUpPriority: 0.8,
                        riskTolerance: 0.6
                    }
                };

                // Select personality based on difficulty
                const types = Object.keys(personalities);
                const personalityIndex = Math.floor((this.difficulty - 1) / 1.25);
                return personalities[types[personalityIndex] || 'balanced'];
            }

            calculateNextMove(gameState) {
                const { food, powerUps, playerSnake } = gameState;
                
                // Calculate size advantage
                const sizeAdvantage = this.body.length - playerSnake.body.length;
                
                // Become aggressive when size advantage exists
                if (sizeAdvantage >= this.aggressionThreshold) {
                    const interceptMove = this.calculateInterceptMove(playerSnake);
                    if (interceptMove) {
                        return interceptMove;
                    }
                }
                
                // Existing power-up and opportunity logic
                return super.calculateNextMove(gameState);
            }

            calculateInterceptMove(playerSnake) {
                const head = this.body[0];
                const playerHead = playerSnake.body[0];
                const playerDirection = playerSnake.direction;

                // Predict player's next few positions
                const predictedPositions = this.predictPlayerPath(playerSnake, 5);
                
                // Find best interception point
                let bestMove = null;
                let bestScore = -Infinity;

                const possibleMoves = this.getPossibleMoves();
                possibleMoves.forEach(move => {
                    const nextPos = {
                        x: head.x + move.x,
                        y: head.y + move.y
                    };

                    predictedPositions.forEach((predictedPos, index) => {
                        const distanceToIntercept = this.calculateDistance(nextPos, predictedPos);
                        const score = this.evaluateInterceptMove(distanceToIntercept, index, playerSnake);

                        if (score > bestScore) {
                            bestScore = score;
                            bestMove = move;
                        }
                    });
                });

                return bestMove;
            }

            predictPlayerPath(playerSnake, steps) {
                const positions = [];
                let currentPos = { ...playerSnake.body[0] };
                const direction = playerSnake.direction;

                for (let i = 0; i < steps; i++) {
                    currentPos = {
                        x: currentPos.x + direction.x,
                        y: currentPos.y + direction.y
                    };
                    positions.push({ ...currentPos });
                }

                return positions;
            }

            evaluateInterceptMove(distance, predictionStep, playerSnake) {
                let score = 100 - distance * 10; // Base score based on distance

                // Bonus for intercepting sooner
                score += (5 - predictionStep) * 15;

                // Consider if we can trap the player against a wall
                if (this.canTrapAgainstWall(playerSnake)) {
                    score += 50;
                }

                // Consider if we're cutting off player's escape routes
                if (this.isBlockingEscapeRoutes(playerSnake)) {
                    score += 30;
                }

                return score;
            }

            canTrapAgainstWall(playerSnake) {
                const head = playerSnake.body[0];
                const gridWidth = Math.floor(canvas.width / GRID_SIZE);
                const gridHeight = Math.floor(canvas.height / GRID_SIZE);

                // Check if player is near a wall
                return (
                    head.x <= 2 || head.x >= gridWidth - 3 ||
                    head.y <= 2 || head.y >= gridHeight - 3
                );
            }

            isBlockingEscapeRoutes(playerSnake) {
                const head = playerSnake.body[0];
                const escapeRoutes = [
                    { x: head.x + 1, y: head.y },
                    { x: head.x - 1, y: head.y },
                    { x: head.x, y: head.y + 1 },
                    { x: head.x, y: head.y - 1 }
                ];

                // Count blocked escape routes
                const blockedRoutes = escapeRoutes.filter(route => 
                    this.body.some(segment => 
                        segment.x === route.x && segment.y === route.y
                    )
                ).length;

                return blockedRoutes >= 2; // Return true if at least 2 escape routes are blocked
            }

            updateBehaviorState(playerSnake) {
                const sizeDifference = this.body.length - playerSnake.body.length;
                const distanceToPlayer = this.calculateDistance(this.body[0], playerSnake.body[0]);
                
                // More aggressive behavior when larger
                if (sizeDifference >= this.aggressionThreshold) {
                    if (distanceToPlayer < this.huntingRange) {
                        this.behaviorState = 'hunting';
                        this.powerUpPriority = 0.3; // Lower priority for power-ups while hunting
                    } else {
                        this.behaviorState = 'seeking';
                        this.powerUpPriority = 0.6;
                    }
                } else {
                    // Existing behavior state logic
                    super.updateBehaviorState(playerSnake);
                }
            }

            evaluateMove(move, threats, opportunities) {
                let score = super.evaluateMove(move, threats, opportunities);
                
                // Add aggressive behavior modifiers
                if (this.behaviorState === 'hunting') {
                    const nextPos = {
                        x: this.body[0].x + move.x,
                        y: this.body[0].y + move.y
                    };
                    
                    // Bonus for moves that get closer to the player
                    const distanceToPlayer = this.calculateDistance(nextPos, game.snake2.body[0]);
                    score += (this.huntingRange - distanceToPlayer) * 15;
                    
                    // Bonus for moves that block player's path
                    if (this.isBlockingPlayerPath(nextPos, game.snake2)) {
                        score += 40;
                    }
                }
                
                return score;
            }

            isBlockingPlayerPath(position, playerSnake) {
                const playerHead = playerSnake.body[0];
                const playerDirection = playerSnake.direction;
                
                // Check if our position blocks the player's forward path
                const playerNextPos = {
                    x: playerHead.x + playerDirection.x,
                    y: playerHead.y + playerDirection.y
                };
                
                return (
                    position.x === playerNextPos.x && position.y === playerNextPos.y ||
                    this.isInPlayerPathLine(position, playerSnake)
                );
            }

            isInPlayerPathLine(position, playerSnake) {
                const playerHead = playerSnake.body[0];
                const playerDirection = playerSnake.direction;
                
                // Check if we're in the line of player's movement
                if (playerDirection.x !== 0) {
                    return position.y === playerHead.y && 
                           Math.abs(position.x - playerHead.x) < 3;
                } else {
                    return position.x === playerHead.x && 
                           Math.abs(position.y - playerHead.y) < 3;
                }
            }
        }

        class Game {
            constructor(playerName) {
                this.aiDifficulty = 1;
                this.playerWins = 0;
                this.aiWins = 0;
                this.gameStartTime = Date.now();
                this.survivalTime = 0;
                this.currentWinStreak = 0;
                this.lastTimeCheck = Date.now();
                
                this.snake1 = new Snake(
                    '#334155',  // Slate fill
                    '#dc2626',  // Red border
                    5, 10, 
                    true,
                    this.aiDifficulty
                );
                this.snake2 = new Snake(
                    '#334155',  // Same slate fill
                    '#3b82f6',  // Blue border
                    25, 10
                );
                this.food = this.generateFood();
                this.playerName = playerName;
                this.powerUps = [];
                this.lastPowerUpTime = 0;

                // Load scores from localStorage
                this.scores = this.loadScores();
                
                // Initialize score display with loaded scores
                document.getElementById('player-score').textContent = this.scores.wins;
                document.getElementById('ai-score').textContent = this.scores.losses;
                
                this.powerUpTypes = ['speed', 'shield', 'ghost', 'reverse', 'freeze', 'growth'];
                this.cloneSnakes = [];
                this.powerUpDescriptions = {
                    speed: { name: 'Speed Boost', color: '#fbbf24' },
                    shield: { name: 'Shield', color: '#60a5fa' },
                    ghost: { name: 'Ghost Mode', color: '#a78bfa' },
                    reverse: { name: 'Reverse', color: '#f59e0b' },
                    freeze: { name: 'Freeze', color: '#38bdf8' },
                    growth: { name: 'Growth', color: '#22c55e' }
                };
                this.portals = []; // Array to store active portals

                // Add titles system
                this.titles = this.loadTitles() || [];
                this.titleDefinitions = {
                    'Naga Guardian': {
                        description: 'Harness the power of the Naga in battle.',
                        condition: (stats) => stats.shield >= 5
                    },
                    'Serpent of Speed': {
                        description: 'Swift as the legendary serpent, strike with haste.',
                        condition: (stats) => stats.speed >= 5
                    },
                    'Chimeras\'s Embrace': {
                        description: 'Embody the fierce spirit of the Chimera.',
                        condition: (stats) => stats.freeze >= 5
                    },
                    'Basilisk\'s Gaze': {
                        description: 'Stare down your foes like the fearsome Basilisk.',
                        condition: (stats) => stats.reverse >= 5
                    },
                    'Hydra\'s Growth': {
                        description: 'Grow stronger, like the many-headed Hydra.',
                        condition: (stats) => stats.growth >= 5
                    },
                    'Dragon\'s Devourer': {
                        description: 'Devour your enemies like a dragon feasting.',
                        condition: (stats) => this.devourCount >= 5
                    },
                    'Serpent King': {
                        description: 'Rule the battlefield like a mighty serpent king.',
                        condition: (stats) => this.devourCount >= 10
                    },
                    'Ouroboros': {
                        description: 'Eternal cycle of life and death, consume endlessly.',
                        condition: (stats) => this.scores.wins >= 1
                    },
                    'Medusa\'s Touch': {
                        description: 'Freeze your foes in place with a deadly stare.',
                        condition: (stats) => stats.freeze >= 5
                    },
                    'Jörmungandr\'s Wrath': {
                        description: 'Unleash the fury of the world serpent.',
                        condition: (stats) => this.snake2.body.length >= 20
                    },
                    'Ghostly Serpent': {
                        description: 'Use ghost power to evade and confuse enemies.',
                        condition: (stats) => stats.ghost >= 10
                    },
                    'Speed Demon': {
                        description: 'Outpace all foes with unmatched speed and agility.',
                        condition: (stats) => stats.speed >= 15
                    },
                    'Divine Shield': {
                        description: 'Survive against all odds with protective power.',
                        condition: (stats) => stats.shieldTime >= 20
                    },
                    'Tiamat\'s Champion': {
                        description: 'Conquer the strongest foes with cunning and strength.',
                        condition: (stats) => this.scores.wins >= 1 && this.aiDifficulty === 5
                    },
                    'Silver tounge': {
                        description: 'A con artist who has pure skill.',
                        condition: (stats) => this.scores.wins >= 1 && stats.total === 0
                    },
                    'Ryu Master': {
                        description: 'Channel the power of Eastern dragon spirits.',
                        condition: (stats) => Object.values(stats).every(count => count > 0)
                    },
                    'Apophis Incarnate': {
                        description: 'Embody the great serpent of chaos',
                        condition: (stats) => this.currentWinStreak >= 5
                    },
                    'Orochi\'s Legacy': {
                        description: 'Eight-headed serpent\'s chosen successor.',
                        condition: (stats) => this.survivalTime >= 120
                    },
                    'Champion of the Serpent\'s Den': {
                        description: 'Conquer the arena, proving your might among the serpents.',
                        condition: (stats) => stats.wins >= 10
                    },
                    'Wyrm\'s Wrath': {
                        description: 'Unleash the fury of the wyrm, a force to be reckoned with.',
                        condition: (stats) => stats.wins >= 20
                    },
                    'Guardian of the Serpent\'s Heart': {
                        description: 'Defend your title fiercely, as the guardian of the sacred heart.',
                        condition: (stats) => stats.wins >= 1
                    },
                    'Serpent Slayer': {
                        description: 'Defeat your foes with the precision of a striking serpent.',
                        condition: (stats) => stats.wins >= 50
                    },
                    'Eternal Serpent': {
                        description: 'Achieve immortality through victories, becoming a legend.',
                        condition: (stats) => stats.wins >= 100
                    },
                    'Conqueror of the Serpent\'s Realm': {
                        description: 'Dominate the realm, earning respect as the ultimate conqueror.',
                        condition: (stats) => stats.wins >= 150
                    },
                    'Serpent of the Abyss': {
                        description: 'Wield the power of the ancient serpent that dwells in the depths.',
                        condition: (stats) => stats.survivalTime >= 10
                    },
                    'Venomous Sage': {
                        description: 'Master the art of poison, a wisdom passed through generations.',
                        condition: (stats) => stats.survivalTime >= 120
                    },
                    'Fang of the Ancients': {
                        description: 'A legendary serpent\'s fang, symbolizing strength and resilience.',
                        condition: (stats) => stats.survivalTime >= 180
                    },
                    'Caduceus Wielder': {
                        description: 'Bearer of the Caduceus, a symbol of balance and healing.',
                        condition: (stats) => stats.survivalTime >= 240
                    },
                    'Scales of Destiny': {
                        description: 'Wear the scales of fate, guiding your path through trials.',
                        condition: (stats) => stats.survivalTime >= 300
                    },
                    'Serpent of the Stars': {
                        description: 'A celestial serpent, weaving the fabric of the cosmos.',
                        condition: (stats) => stats.survivalTime >= 360
                    },
                    'Long Lasting Snake': {
                        description: 'Survive for at least 0.5 seconds.',
                        condition: (stats) => stats.survivalTime >= 0.5
                    },
                    'Lone Serpent': {
                        description: 'The one who is alone.',
                        condition: (stats) => stats.survivalTime >= 200
                    },
                    'Debugging Serpent': {
                        description: 'Survive for at least 5000000 seconds for debugging purposes.',
                        condition: (stats) => stats.survivalTime >= 5000000
                    },
                    'Serpent of Eternity': {
                        description: 'A legendary serpent that embodies the cycle of life and death, eternal and wise.',
                        condition: (stats) => stats.survivalTime >= 10 // Condition set to 10 seconds for testing
                    },
                };

                this.powerUpStats = this.loadPowerUpStats();
                this.currentWinStreak = 0;
                this.survivalTime = 0;
                this.initializeTitleSystem();
                this.updateTitlesDisplay(); // Ensure titles are displayed on initialization
                this.sessionPowerUpStats = { speed: 0, shield: 0, ghost: 0, reverse: 0, freeze: 0, growth: 0 }; // Track session-based power-up usage
                this.gamePowerUpStats = { speed: 0, shield: 0, ghost: 0, reverse: 0, freeze: 0, growth: 0 }; // Track game-based power-up usage
            }

            resetPowerUpStats() {
                // Reset game-specific power-up stats
                this.gamePowerUpStats = {
                    speed: 0,
                    shield: 0,
                    ghost: 0,
                    reverse: 0,
                    freeze: 0,
                    growth: 0
                };
            }
            updateGameTime() {
                const currentTime = Date.now();
                const deltaTime = currentTime - this.lastTimeCheck;

                // Ensure deltaTime is a valid number before updating survivalTime
                if (!isNaN(deltaTime)) {
                    this.survivalTime += deltaTime / 1000; // Convert to seconds
                }

                this.lastTimeCheck = currentTime;
            }

            loadTitles() {
                const storedTitles = localStorage.getItem('snakeTitles');
                return storedTitles ? JSON.parse(storedTitles) : [];
            }

            saveTitles() {
                localStorage.setItem('snakeTitles', JSON.stringify(this.titles));
                this.updateTitlesDisplay(); // Update display whenever titles are saved
            }

            loadPowerUpStats() {
                const defaultStats = {
                    speed: 0,
                    shield: 0,
                    ghost: 0,
                    reverse: 0,
                    freeze: 0,
                    growth: 0,
                    total: 0,
                    shieldTime: 0
                };
                return JSON.parse(localStorage.getItem('snakeGamePowerUpStats')) || defaultStats;
            }

            savePowerUpStats() {
                localStorage.setItem('snakeGamePowerUpStats', JSON.stringify(this.powerUpStats));
            }

            initializeTitleSystem() {
                const titleButton = document.getElementById('title-button');
                const titlesDropdown = document.getElementById('titles-dropdown');

                titleButton.addEventListener('click', () => {
                    titlesDropdown.style.display = titlesDropdown.style.display === 'none' ? 'block' : 'none';
                    this.updateTitlesDisplay();
                });

                // Close dropdown when clicking outside
                document.addEventListener('click', (e) => {
                    if (!titleButton.contains(e.target) && !titlesDropdown.contains(e.target)) {
                        titlesDropdown.style.display = 'none';
                    }
                });
            }

            checkForNewTitles() {
                Object.entries(this.titleDefinitions).forEach(([title, def]) => {
                    const conditionMet = def.condition(this);
                    if (!this.titles.includes(title) && conditionMet) {
                        this.awardTitle(title);
                    }
                });
            }

            awardTitle(title) {
                this.titles.push(title);
                this.saveTitles();
                this.showTitleNotification(title);
            }

            showTitleNotification(title) {
                const notification = document.createElement('div');
                notification.className = 'new-title-notification';
                notification.textContent = `New Title Unlocked: ${title}!`;
                document.body.appendChild(notification);

                setTimeout(() => {
                    notification.remove();
                }, 3000);
            }

            updateTitlesDisplay() {
                const titlesDropdown = document.getElementById('titles-dropdown');
                if (!titlesDropdown) return;

                titlesDropdown.innerHTML = '';
                
                if (this.titles.length === 0) {
                    titlesDropdown.innerHTML = '<div class="title-item">No titles yet. Keep playing to earn titles!</div>';
                    return;
                }

                this.titles.forEach(title => {
                    const titleElement = document.createElement('div');
                    titleElement.className = 'title-item';
                    const titleDescription = this.titleDefinitions[title]?.description || 'Description not available'; // Handle missing descriptions
                    titleElement.innerHTML = `
                        ${title}
                        <div class="title-description">${titleDescription}</div>
                    `;
                    titlesDropdown.appendChild(titleElement);
                });
            }

            loadScores() {
                const savedScores = localStorage.getItem('snakeGameScores');
                if (savedScores) {
                    return JSON.parse(savedScores);
                }
                return {
                    wins: 0,
                    losses: 0
                };
            }

            saveScores() {
                localStorage.setItem('snakeGameScores', JSON.stringify(this.scores));
            }

            resetScores() {
                this.scores = {
                    wins: 0,
                    losses: 0
                };
                this.saveScores();
                document.getElementById('player-score').textContent = '0';
                document.getElementById('ai-score').textContent = '0';
            }

            generateFood() {
                return {
                    x: Math.floor(Math.random() * (canvas.width / GRID_SIZE)),
                    y: Math.floor(Math.random() * (canvas.height / GRID_SIZE))
                };
            }

            generatePowerUp() {
                const now = Date.now();
                if (now - this.lastPowerUpTime > POWERUP_INTERVAL && this.powerUps.length < 1) { // Every 10 seconds max
                    const types = ['speed', 'shield', 'ghost', 'reverse', 'freeze', 'growth'];
                    const type = types[Math.floor(Math.random() * types.length)];
                    
                    // Find a free spot
                    let x, y;
                    do {
                        x = Math.floor(Math.random() * (canvas.width / GRID_SIZE));
                        y = Math.floor(Math.random() * (canvas.height / GRID_SIZE));
                    } while (this.isPositionOccupied(x, y));

                    this.powerUps.push({ x, y, type });
                    this.lastPowerUpTime = now;
                }
            }

            isPositionOccupied(x, y) {
                // Check if position collides with snakes or food
                return (
                    this.snake1.body.some(segment => segment.x === x && segment.y === y) ||
                    this.snake2.body.some(segment => segment.x === x && segment.y === y) ||
                    (this.food.x === x && this.food.y === y)
                );
            }

            drawFood() {
                ctx.fillStyle = '#22c55e'; // Bright green food
                ctx.beginPath();
                ctx.arc(
                    this.food.x * GRID_SIZE + GRID_SIZE / 2, 
                    this.food.y * GRID_SIZE + GRID_SIZE / 2, 
                    GRID_SIZE / 2, 0, Math.PI * 2
                );
                ctx.fill();
                
                // Add a white border to the food
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            checkFoodCollision(snake) {
                if (!snake || !snake.body || !snake.body[0]) return false;
                
                const head = snake.body[0];
                if (head.x === this.food.x && head.y === this.food.y) {
                    // Double growth if growth power-up is active
                    if (snake.powerUp === 'growth') {
                        snake.grow();
                        snake.grow();
                    } else {
                        snake.grow();
                    }
                    this.food = this.generateFood();
                    return true;
                }
                return false;
            }

            determineWinner() {
                const snake1Head = this.snake1.body[0];
                const snake2Head = this.snake2.body[0];

                // Check for wall collisions first
                if (this.checkWallCollision(snake2Head)) {
                    return 'self'; // Player hit wall
                }
                if (this.checkWallCollision(snake1Head)) {
                    return 'self'; // AI hit wall
                }

                // Check for self collisions
                if (this.checkSelfCollision(this.snake2)) {
                    return 'self'; // Player hit self
                }
                if (this.checkSelfCollision(this.snake1)) {
                    return 'self'; // AI hit self
                }

                // Check for snake collisions
                if (snake1Head.x === snake2Head.x && snake1Head.y === snake2Head.y) {
                    // Head-on collision, compare lengths
                    if (this.snake1.body.length === this.snake2.body.length) {
                        return 'tie';
                    }
                    return 'snake';
                }

                // Check if one snake hits the body of another
                if (this.checkSnakeCollision(snake1Head, this.snake2.body) || 
                    this.checkSnakeCollision(snake2Head, this.snake1.body)) {
                    return 'snake';
                }

                return null; // No winner yet
            }

            checkWallCollision(head) {
                return (
                    head.x < 0 || 
                    head.x >= canvas.width / GRID_SIZE || 
                    head.y < 0 || 
                    head.y >= canvas.height / GRID_SIZE
                );
            }

            checkSelfCollision(snake) {
                const head = snake.body[0];
                return snake.body.slice(1).some(segment => 
                    segment.x === head.x && segment.y === head.y
                );
            }

            checkSnakeCollision(head, otherSnakeBody) {
                return otherSnakeBody.some(segment => 
                    head.x === segment.x && head.y === segment.y
                );
            }

            addVisualEffects() {
                // Particle effect when eating food
                this.createParticles(this.food.x, this.food.y);
                
                // Snake trail effect
                this.drawTrail(this.snake1.body);
                this.drawTrail(this.snake2.body);
                
                // Power-up glow effect
                if (this.snake1.hasPowerUp) {
                    this.drawGlowEffect(this.snake1);
                }
                if (this.snake2.hasPowerUp) {
                    this.drawGlowEffect(this.snake2);
                }
            }

            createParticles(x, y) {
                const particles = [];
                for (let i = 0; i < 8; i++) {
                    particles.push({
                        x: x * GRID_SIZE + GRID_SIZE / 2,
                        y: y * GRID_SIZE + GRID_SIZE / 2,
                        vx: (Math.random() - 0.5) * 4,
                        vy: (Math.random() - 0.5) * 4,
                        life: 1
                    });
                }
                // Animate particles...
            }

            drawTrail(body) {
                // Implementation of drawTrail method
            }

            drawGlowEffect(snake) {
                // Implementation of drawGlowEffect method
            }

            checkPowerUpCollision(snake) {
                const head = snake.body[0];
                const powerUpIndex = this.powerUps.findIndex(p => p.x === head.x && p.y === head.y);
                
                if (powerUpIndex !== -1) {
                    const powerUp = this.powerUps[powerUpIndex];
                    if (snake === this.snake2) { // Only track player power-ups
                        // Update both game and persistent stats
                        this.gamePowerUpStats[powerUp.type]++;
                        this.powerUpStats[powerUp.type]++;
                        this.powerUpStats.total++;
                        this.savePowerUpStats(); // Save to localStorage
                        
                        // Check for new titles after collecting power-up
                        this.checkForNewTitles();
                    }
                    this.powerUps.splice(powerUpIndex, 1);
                    snake.activatePowerUp(powerUp.type);
                }
            }
            drawPowerUps() {
                this.powerUps.forEach(powerUp => {
                    ctx.beginPath();
                    const size = 6; // Reduced size for power-ups
                    const x = powerUp.x * GRID_SIZE + GRID_SIZE / 2;
                    const y = powerUp.y * GRID_SIZE + GRID_SIZE / 2;
                    
                    // Add glow effect
                    ctx.shadowColor = this.getPowerUpColor(powerUp.type);
                    ctx.shadowBlur = 8;
                    
                    switch(powerUp.type) {
                        case 'speed':
                            // Lightning bolt shape
                            ctx.moveTo(x - size/2, y - size);
                            ctx.lineTo(x + size/2, y - size/2);
                            ctx.lineTo(x - size/4, y);
                            ctx.lineTo(x + size/2, y + size);
                            break;
                            
                        case 'shield':
                            // Shield shape
                            ctx.arc(x, y, size, 0, Math.PI, true);
                            ctx.lineTo(x - size, y);
                            break;
                            
                        case 'ghost':
                            // Ghost shape
                            ctx.arc(x, y - size/2, size, Math.PI, 0, true);
                            ctx.lineTo(x + size, y + size);
                            ctx.lineTo(x - size, y + size);
                            ctx.closePath();
                            break;
                            
                        case 'reverse':
                            // Circular arrow
                            ctx.arc(x, y, size, 0, 1.5 * Math.PI);
                            ctx.lineTo(x + size/2, y - size/2);
                            break;
                            
                        case 'freeze':
                            ctx.beginPath();
                            for(let i = 0; i < 6; i++) {
                                const angle = (i * Math.PI / 3);
                                const x1 = x + Math.cos(angle) * size;
                                const y1 = y + Math.sin(angle) * size;
                                ctx.moveTo(x, y);
                                ctx.lineTo(x1, y1);
                            }
                            break;
                            
                        case 'growth':
                            // Draw plus sign
                            ctx.beginPath();
                            // Horizontal line
                            ctx.moveTo(x - size, y);
                            ctx.lineTo(x + size, y);
                            // Vertical line
                            ctx.moveTo(x, y - size);
                            ctx.lineTo(x, y + size);
                            break;
                    }
                    
                    // Fill with color
                    ctx.fillStyle = this.getPowerUpColor(powerUp.type);
                    ctx.fill();
                    
                    // Add white border
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    
                    // Reset shadow
                    ctx.shadowBlur = 0;
                    
                    // Add pulsing animation
                    const pulseSize = Math.sin(Date.now() / 200) * 2;
                    ctx.beginPath();
                    ctx.arc(x, y, size + pulseSize, 0, Math.PI * 2);
                    ctx.strokeStyle = this.getPowerUpColor(powerUp.type);
                    ctx.globalAlpha = 0.3;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                });
            }

            getPowerUpColor(type) {
                switch(type) {
                    case 'speed': return '#fbbf24';
                    case 'shield': return '#60a5fa';
                    case 'ghost': return '#a78bfa';
                    case 'reverse': return '#f59e0b';
                    case 'freeze': return '#38bdf8';
                    case 'growth': return '#22c55e';
                    default: return '#ffffff';
                }
            }

            showPowerUpInfo(type, isPlayer = true) {
                const infoElement = document.getElementById('powerup-info');
                const powerUp = this.powerUpDescriptions[type];
                infoElement.textContent = `${isPlayer ? 'Player' : 'AI'} got ${powerUp.name}!`;
                infoElement.style.color = powerUp.color;
                infoElement.classList.add('active');
                
                setTimeout(() => {
                    infoElement.classList.remove('active');
                }, 2000);
            }

            updateActivePowerUps() {
                const container = document.getElementById('active-powerups');
                container.innerHTML = '';

                // Show player power-ups
                if (this.snake2.powerUp) {
                    const powerUp = this.powerUpDescriptions[this.snake2.powerUp];
                    const timer = document.createElement('div');
                    timer.className = 'powerup-timer';
                    timer.style.color = powerUp.color;
                    timer.textContent = `Player: ${powerUp.name}`;
                    container.appendChild(timer);
                }

                // Show AI power-ups
                if (this.snake1.powerUp) {
                    const powerUp = this.powerUpDescriptions[this.snake1.powerUp];
                    const timer = document.createElement('div');
                    timer.className = 'powerup-timer';
                    timer.style.color = powerUp.color;
                    timer.textContent = `AI: ${powerUp.name}`;
                    container.appendChild(timer);
                }
            }

            updateDifficulty() {
                // Adjust difficulty based on win ratio
                const totalGames = this.playerWins + this.aiWins;
                if (totalGames >= 3) {
                    const playerWinRate = this.playerWins / totalGames;
                    
                    // Adjust difficulty based on player win rate
                    if (playerWinRate > 0.7) {
                        this.aiDifficulty = Math.min(5, this.aiDifficulty + 1);
                    } else if (playerWinRate < 0.3) {
                        this.aiDifficulty = Math.max(1, this.aiDifficulty - 1);
                    }
                }
                
                // Update AI snake with new difficulty
                this.snake1.difficulty = this.aiDifficulty;
            }

            update() {
                // Update and draw clone snakes
                this.cloneSnakes = this.cloneSnakes.filter(clone => {
                    if (Date.now() < clone.expiryTime) {
                        clone.move(this.food, null);
                        clone.draw();
                        // Check if clone collected food
                        if (this.checkFoodCollision(clone)) {
                            this.scores.losses++;
                            document.getElementById('ai-score').textContent = this.scores.losses;
                        }
                        return true;
                    }
                    return false;
                });
            }

            createPortals() {
                // Clear existing portals
                this.portals = [];
                
                // Create two random portal positions
                for (let i = 0; i < 2; i++) {
                    let portalPos;
                    do {
                        portalPos = {
                            x: Math.floor(Math.random() * (canvas.width / GRID_SIZE)),
                            y: Math.floor(Math.random() * (canvas.height / GRID_SIZE))
                        };
                    } while (
                        // Ensure portals don't overlap with snakes or each other
                        this.isPositionOccupied(portalPos) ||
                        this.portals.some(p => p.x === portalPos.x && p.y === portalPos.y)
                    );
                    this.portals.push(portalPos);
                }

                // Remove portals after duration
                setTimeout(() => {
                    this.portals = [];
                }, POWERUP_DURATION);
            }

            drawPortals() {
                if (this.portals.length === 2) {
                    this.portals.forEach((portal, index) => {
                        ctx.beginPath();
                        ctx.arc(
                            portal.x * GRID_SIZE + GRID_SIZE / 2,
                            portal.y * GRID_SIZE + GRID_SIZE / 2,
                            GRID_SIZE / 2,
                            0,
                            Math.PI * 2
                        );
                        ctx.fillStyle = '#14b8a6' + (index === 0 ? '88' : 'cc');
                        ctx.strokeStyle = '#0d9488';
                        ctx.lineWidth = 2;
                        ctx.fill();
                        ctx.stroke();

                        // Add portal effect
                        ctx.beginPath();
                        ctx.arc(
                            portal.x * GRID_SIZE + GRID_SIZE / 2,
                            portal.y * GRID_SIZE + GRID_SIZE / 2,
                            GRID_SIZE / 3,
                            0,
                            Math.PI * 2
                        );
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    });
                }
            }

            checkPortalCollision(snake) {
                if (this.portals.length !== 2) return false;

                const head = snake.body[0];
                const portalIndex = this.portals.findIndex(p => p.x === head.x && p.y === head.y);

                if (portalIndex !== -1) {
                    // Teleport to the other portal
                    const otherPortalIndex = portalIndex === 0 ? 1 : 0;
                    snake.body[0] = { ...this.portals[otherPortalIndex] };
                    return true;
                }
                return false;
            }

            handleGameOver(playerWon) {
                if (playerWon) {
                    this.currentWinStreak++;
                    // Check titles after winning
                    this.checkForNewTitles();
                } else {
                    this.currentWinStreak = 0;
                }
                
                // Save stats
                this.savePowerUpStats();
                this.resetPowerUpStats();
            }
        }

        let game;
        let gameLoopId;

        let soundsInitialized = false;

        // Function to initialize sounds
        function initializeSounds() {
            const backgroundMusic = document.getElementById('background-music');
            const buttonClickSound = document.getElementById('button-click-sound');

            // Set volume for background music
            backgroundMusic.volume = 0.2; // Decrease volume to 20%
            backgroundMusic.load(); // Load the background music
            backgroundMusic.play().catch(error => console.error("Error playing background music:", error));

            soundsInitialized = true;
        }

        // Function to play button click sound
        function playButtonClickSound() {
            const buttonClickSound = document.getElementById('button-click-sound');
            buttonClickSound.volume = 0.5; // Set volume for button click sound
            buttonClickSound.play().catch(error => console.error("Error playing button click sound:", error));
        }

        // Event listener for the "Begin Duel" button
        document.getElementById('start-button').addEventListener('click', () => {
            if (!soundsInitialized) {
                console.log("Initializing sounds...");
                initializeSounds(); // Initialize sounds on first interaction
            }
            startGame(); // Your existing function to start the game
        });

        // Attach the click sound to all buttons
        document.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', playButtonClickSound);
        });

        function startGame() {
            document.getElementById('background-music').play(); // Start background music
            const playerName = document.getElementById('player-name').value || 'Player';
            
            if (!playerName) {
                alert('Please enter a name');
                return;
            }

            // Only create new game if it doesn't exist or is first game
            if (!game) {
                game = new Game(playerName);
                // Add reset button only once when game is first created
                addResetButton();
            } else {
                game.playerName = playerName;
            }

            startScreen.style.display = 'none';
            canvas.style.display = 'block';
            gameLoop();
        }

        function resetGame() {
            cancelAnimationFrame(gameLoopId);
            gameOverScreen.style.display = 'none';
            startScreen.style.display = 'block';
            canvas.style.display = 'none';
            
            // Reset game state but keep scores
            if (game) {
                game.snake1 = new Snake('#334155', '#dc2626', 5, 10, true, game.aiDifficulty);
                game.snake2 = new Snake('#334155', '#3b82f6', 25, 10);
                game.food = game.generateFood();
                game.powerUps = [];
                game.lastPowerUpTime = 0;

                // Reset game-specific power-up stats
                game.resetPowerUpStats();

                // Reset survival time
                game.survivalTime = 0; // Reset survival time to 0
                game.lastTimeCheck = Date.now(); // Reset lastTimeCheck to current time
            }
        }

        function handleKeyPress(event) {
            const key = event.key;

            if (key === 'a' && game.snake2.direction.x !== 1) 
                game.snake2.direction = { x: -1, y: 0 };
            else if (key === 'd' && game.snake2.direction.x !== -1) 
                game.snake2.direction = { x: 1, y: 0 };
            else if (key === 'w' && game.snake2.direction.y !== 1) 
                game.snake2.direction = { x: 0, y: -1 };
            else if (key === 's' && game.snake2.direction.y !== -1) 
                game.snake2.direction = { x: 0, y: 1 };
        }

        function gameLoop() {
            if (!game) return;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            game.updateGameTime();

            // Check for new titles every second
            if (Math.floor(game.survivalTime) % 1 === 0) {
                game.checkForNewTitles(); // Ensure this is called
            }

            game.generatePowerUp();
            game.update();

            const snake1Collision = game.snake1.move(game.food, game.snake2);
            const snake2Collision = game.snake2.move(game.food, game.snake1);

            game.checkPowerUpCollision(game.snake1);
            game.checkPowerUpCollision(game.snake2);

            // Handle game over conditions
            if (snake1Collision || snake2Collision) {
                canvas.style.display = 'none';
                gameOverScreen.style.display = 'block';
                
                // Clear and specific win/loss conditions
                if (snake2Collision === 'self') {
                    // Player hit wall or self
                    gameOverMessage.textContent = 'You lost by hitting the wall or yourself!';
                    game.scores.losses++;
                    document.getElementById('ai-score').textContent = game.scores.losses;
                } else if (snake1Collision === 'self') {
                    // AI hit wall or self
                    gameOverMessage.textContent = `${game.playerName} wins! AI hit the wall or itself!`;
                    game.scores.wins++;
                    document.getElementById('player-score').textContent = game.scores.wins;
                } else if (snake1Collision === 'snake' || snake2Collision === 'snake') {
                    // Snake collision - compare lengths to determine winner
                    if (game.snake1.body.length > game.snake2.body.length) {
                        gameOverMessage.textContent = 'You got devoured by the AI!';
                        game.scores.losses++;
                        document.getElementById('ai-score').textContent = game.scores.losses;
                    } else if (game.snake2.body.length > game.snake1.body.length) {
                        gameOverMessage.textContent = `${game.playerName} wins by devouring the AI!`;
                        game.scores.wins++;
                        document.getElementById('player-score').textContent = game.scores.wins;
                    } else {
                        gameOverMessage.textContent = 'Tie! Both snakes collided with equal size!';
                        // Don't update scores for ties
                    }
                }
                
                // Save scores after each game
                game.saveScores();
                game.updateDifficulty();
                return;
            }

            game.checkFoodCollision(game.snake1);
            game.checkFoodCollision(game.snake2);

            game.drawPowerUps();
            game.snake1.draw();
            game.snake2.draw();
            game.drawFood();

            game.drawPortals();
            game.updateActivePowerUps();
            gameLoopId = requestAnimationFrame(gameLoop);
        }

        document.addEventListener('keydown', handleKeyPress);

        // Add a reset scores button to the HTML
        function addResetButton() {
            // Check if reset button already exists
            if (document.getElementById('reset-scores-button')) {
                return; // Don't add another button if it exists
            }

            const resetButton = document.createElement('button');
            resetButton.textContent = 'Reset Scores';
            resetButton.id = 'reset-scores-button'; // Add an ID to identify the button
            resetButton.onclick = function() {
                if (confirm('Are you sure you want to reset all scores?')) {
                    game.resetScores();
                }
            };
            
            const gameOverScreen = document.getElementById('game-over-screen');
            const playAgainButton = document.querySelector('#game-over-screen button');
            gameOverScreen.insertBefore(resetButton, playAgainButton);
        }

        