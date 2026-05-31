class Model {
    MAX_CPS = 18; // Soft warning limit
    HARD_LIMIT = 24; // Hard kick limit
    WINDOW_TICKS = 20;
    BUF_SIZE = this.HARD_LIMIT;

    playerState = new Map();

    createPlayerData = () => ({
        buf: new Int32Array(this.BUF_SIZE),
        head: 0,
        count: 0,
        lastWarnTick: 0,
    });
}

export default new Model();
