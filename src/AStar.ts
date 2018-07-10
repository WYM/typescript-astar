
/**
 * A*寻路实现
 */
export default class AStar {

    /**
     * 路径长度算法
     */
    public static heuristics = {
        // 曼哈顿算法（适用4方向）
        manhattan: (pos0: { x: number, y: number }, pos1: { x: number, y: number }) => {
            return Math.abs(pos1.x - pos0.x) + Math.abs(pos1.y - pos0.y);
        },
        // 倾斜角算法（适用8方向）
        diagonal: (pos0: { x: number, y: number }, pos1: { x: number, y: number }) => {
            const D = 1;
            const D2 = Math.sqrt(2);
            const d1 = Math.abs(pos1.x - pos0.x);
            const d2 = Math.abs(pos1.y - pos0.y);
            return (D * (d1 + d2)) + ((D2 - (2 * D)) * Math.min(d1, d2));
        }
    };

    /**
     * 根据寻路结果生成路线节点列表
     * @param node 目标节点
     */
    public static pathTo(node: GridNode): GridNode[] {
        let curr = node;
        const path = [];
        while(curr.parent) {
            path.unshift(curr);
            curr = curr.parent;
        }

        return path;
    }

    /**
     * 获取一个二叉堆
     */
    public static getHeap(func?: (e: GridNode) => number) {
        return new BinaryHeap(func ? func : (node) => {
            return node.f;
        });
    }

    /**
     * 执行一次完整A*寻路
     * @param graph 
     * @param start 
     * @param end 
     * @param options 
     */
    public static search(graph: Graph, start: GridNode, end: GridNode, closest: boolean = false, heuristic: (pos0: { x: number, y: number }, pos1: { x: number, y: number }) => number = null): GridNode[] {
        graph.cleanDirty();

        // 默认使用曼哈顿算法
        heuristic = heuristic || AStar.heuristics.manhattan;

        const openHeap = AStar.getHeap();
        let closestNode = start; // 把初始节点设为第一个最近节点

        start.h = heuristic(start, end);
        graph.markDirty(start);

        openHeap.push(start);

        // GO!
        while(openHeap.size() > 0) {
            const currentNode = openHeap.pop();

            // 检查寻路是否结束
            if (currentNode === end) {
                return AStar.pathTo(currentNode);
            }

            // 关闭该节点
            currentNode.closed = true;

            const neighbors = graph.neighbors(currentNode);
            for (let i = 0, len = neighbors.length; i < len; ++i) {
                const neighbor = neighbors[i];

                // 跳过已关闭或不能行走的节点
                if (neighbor.closed || AStar.isNodeWall(neighbor)) {
                    continue;
                }

                // gScore 是该currentNode移动到neighbor的最小消耗
                const gScore = currentNode.g + AStar.getNodeCost(neighbor, currentNode);
                const beenVisited = neighbor.visited;

                if (!beenVisited || gScore < neighbor.g) {

                    neighbor.visited = true;
                    neighbor.parent = currentNode;
                    neighbor.h = neighbor.h || heuristic(neighbor, end);
                    neighbor.g = gScore;
                    neighbor.f = neighbor.g + neighbor.h;
                    graph.markDirty(neighbor);

                    if (closest) {
                        if (neighbor.h < closestNode.h || (neighbor.h === closestNode.h && neighbor.g < closestNode.g)) {
                            closestNode = neighbor;
                        }
                    }

                    if (!beenVisited) {
                        openHeap.push(neighbor);
                    } else {
                        openHeap.rescoreElement(neighbor);
                    }

                }
            }
        }

        if (closest) {
            return this.pathTo(closestNode);
        }
        
        // 无路可走
        return [];
    }

    /**
     * 节点是否是墙
     * @param node 
     */
    public static isNodeWall(node: GridNode): boolean {
        return node.w === 0;
    }

    /**
     * 获取路过该节点的消耗g
     * @param node 
     * @param fromNeighbor 
     */
    public static getNodeCost(node: GridNode, fromNeighbor?: GridNode) {
        // 如果二者位于位置关系为斜角（xy都不同） 则
        if (fromNeighbor && fromNeighbor.x !== node.x && fromNeighbor.y !== node.y) {
            return node.w * 1.41421; // 1.41421是一个斜方向g加权的预算常量
        }

        return node.w;
    }

    /**
     * 节点转字符串
     * @param node 
     */
    public stringfyNode(node: GridNode): string {
        return "[" + node.x + " " + node.y + "]";
    }

    /**
     * 清理一个节点
     * @param node 
     */
    public static cleanNode(node: GridNode) {
        node.f = 0;
        node.g = 0;
        node.h = 0;
        node.visited = false;
        node.closed = false;
        node.parent = null;
    }

}

/**
 * 寻路地图结构
 */
export class Graph {
    public nodes: GridNode[]; // 所有节点的索引
    public grid: GridNode[][]; // 节点二维索引
    public diagonal: boolean; // 是否允许对角（斜方向45度）行走

    public dirtyNodes: GridNode[]; // 脏节点列表

    /**
     * @constructor
     * @param {number[][]} gridIn 初始权重列表，二维数组
     * @param {boolean} diagonal 是否允许对角行走
     */
    constructor(gridIn: number[][], diagonal: boolean = false) {
        this.nodes = [];
        this.grid = [];
        this.diagonal = diagonal;

        for (let i = 0, len = gridIn.length; i < len; ++i) {
            this.grid[i] = [];

            for (let j = 0, row = gridIn[i], jLen = row.length; j < jLen; ++j) {
                const node = {
                    x: i,
                    y: j,
                    w: row[j] 
                }; // TODO 分配内存消耗大，池化
                this.grid[i][j] = node;
                this.nodes.push(node);
            }
        }

        this.init();
    }

    /**
     * 初始化
     */
    public init() {
        this.dirtyNodes = [];
        const nodes = this.nodes;
        for (let i = 0, len = nodes.length; i < len; ++i) {
            AStar.cleanNode(this.nodes[i]); // 清理所有节点 TODO
        }
    }

    /**
     * 将一个节点标记为脏节点
     * @param node 
     */
    public markDirty(node: GridNode): void {
        this.dirtyNodes.push(node);
    }

    /**
     * 清理所有脏节点
     */
    public cleanDirty(): void {
        for (var i = 0; i < this.dirtyNodes.length; i++) {
            AStar.cleanNode(this.dirtyNodes[i]); // 清理所有节点 TODO
        }
        this.dirtyNodes = [];
    }

    /**
     * 获取一个节点的所有相邻节点
     * @param node 
     */
    public neighbors(node: GridNode): GridNode[] {
        const ret: GridNode[] = [];
        const x = node.x;
        const y = node.y;
        const grid = this.grid;

        // L
        if (grid[x - 1] && grid[x - 1][y]) {
            ret.push(grid[x - 1][y]);
        }
      
        // R
        if (grid[x + 1] && grid[x + 1][y]) {
            ret.push(grid[x + 1][y]);
        }
      
        // B
        if (grid[x] && grid[x][y - 1]) {
            ret.push(grid[x][y - 1]);
        }
      
        // T
        if (grid[x] && grid[x][y + 1]) {
            ret.push(grid[x][y + 1]);
        }
      
        if (this.diagonal) {
            // LB
            if (grid[x - 1] && grid[x - 1][y - 1]) {
                ret.push(grid[x - 1][y - 1]);
            }
      
            // RB
            if (grid[x + 1] && grid[x + 1][y - 1]) {
                ret.push(grid[x + 1][y - 1]);
            }
      
            // LT
            if (grid[x - 1] && grid[x - 1][y + 1]) {
                ret.push(grid[x - 1][y + 1]);
            }
      
            // RT
            if (grid[x + 1] && grid[x + 1][y + 1]) {
                ret.push(grid[x + 1][y + 1]);
            }
        }

        return ret;
    }

}

/**
 * 路径节点
 * 
 */
export interface GridNode {

    // 节点属性
    x: number;
    y: number;
    w: number; // 权重 0代表不可行走

    // 寻路属性
    f?: number;
    g?: number;
    h?: number;
    visited?: boolean;
    closed?: boolean;

    // 寻路的上一节点
    parent?: GridNode;

}


/**
 * 小二叉堆
 */
export class BinaryHeap {

    public content: GridNode[]; // 堆内容
    public scoreFunction: (e: GridNode) => number; // 评分函数

    /**
     * @constructor
     * @param scoreFunction 
     */
    constructor(scoreFunction: (e: GridNode) => number) {
        this.content = [];
        this.scoreFunction = scoreFunction;
    }

    /**
     * 向堆中添加一个节点
     * @param e 节点
     */
    public push(e: GridNode): void {
        this.content.push(e);
        this.sinkDown(this.content.length - 1);
    }

    /**
     * 取出并移除最小的节点
     */
    public pop(): GridNode {
        const result = this.content[0]; // 取到了结果
        
        // 取走了一个叶子节点 所以要向上重新排序
        const end = this.content.pop();
        if (this.content.length > 0) {
            this.content[0] = end;
            this.bubbleUp(0);
        }

        return result;
    }
    
    /**
     * 从堆中移除一个节点
     * @param node 
     */
    public remove(node: GridNode): void {
        const i = this.content.indexOf(node);

        const end = this.content.pop();

        if (i !== this.content.length - 1) {
            this.content[i] = end;
            
            if (this.scoreFunction(end) < this.scoreFunction(node)) {
                this.sinkDown(i);
            } else {
                this.bubbleUp(i);
            }
        }
    }

    /**
     * 获取堆节点总数
     */
    public size(): number {
        return this.content.length;
    }
    
    /**
     * 重新排序所有节点
     * @param node 
     */
    public rescoreElement(node: GridNode): void {
        this.sinkDown(this.content.indexOf(node));
    }

    /**
     * 下沉
     * （以n为基准向根部重新排序指定位置的堆节点 只考虑父子关系）
     * @param n 
     */
    public sinkDown(n: number) {
        const scoreFunction = this.scoreFunction;
        const element = this.content[n];

        // 从n向根遍历树的这一分支
        while (n > 0) {
            const parentN = ((n + 1) >> 1) - 1;
            const parent = this.content[parentN];

            // 如果自己比父亲更小 则交换父子关系（排序）
            if (scoreFunction(element) < scoreFunction(parent)) {
                this.content[parentN] = element;
                this.content[n] = parent;
                n = parentN;
            } else {
                break;
            }
        }
    }
        
    /**
     * 上浮
     * （以n为基准向根部重新排序指定位置的堆节点 考虑父子和兄弟关系）
     * @param n 
     */
    public bubbleUp(n: number) {
        const scoreFunction = this.scoreFunction;
        // Look up the target element and its score.
        const length = this.content.length;
        const element = this.content[n];
        const elemScore = scoreFunction(element);
        
        while (true) {
            // 计算两个子节点所在的数组位置
            const child2N = (n + 1) << 1;
            const child1N = child2N - 1;

            // 找出[左子, 右子, 父]中分数最小的一个
            let swap = null;
            let child1Score;
            // 如果左子存在 判断其和父的分数
            if (child1N < length) {
                const child1 = this.content[child1N];
                child1Score = scoreFunction(child1);
                if (child1Score < elemScore) { // 左子如果更小则左子预定上浮
                  swap = child1N;
                }
            }
          
            // 如果右子存在 判断其和父、左子的分数
            if (child2N < length) {
                var child2 = this.content[child2N];
                var child2Score = scoreFunction(child2);
                if (child2Score < (swap === null ? elemScore : child1Score)) { // 右子如果更小则右子预定上浮
                  swap = child2N;
                }
            }
          
            // 如果swap有值 代表需要上浮
            if (swap !== null) {
                this.content[n] = this.content[swap];
                this.content[swap] = element;
                n = swap;
            } else {
                break; // 没swap 这个element不能再上浮了 更靠近根的节点都比它小
            }
        }
    }

}