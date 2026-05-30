class Model {
    MAX_CPS = 20;
    HARD_LIMIT = 24;
    WINDOW_TICKS = 20;
    BUF_SIZE = this.HARD_LIMIT;

    playerState = new Map();

    createPlayerData = () => ({
        buf: new Int32Array(this.BUF_SIZE),
        head: 0,
        count: 0,
    });
}

export default new Model();
