var SCgLayoutObjectType = {
    Node: 0,
    Edge: 1,
    Link: 2,
    Contour: 3,
    DotPoint: 4,
    Custom: 5
};

// Layout algorithms


/**
 * Base layout algorithm
 */
SCg.LayoutAlgorithm = function(nodes, edges, contours, onTickUpdate) {
    this.nodes = nodes;
    this.edges = edges;
    this.contours = contours;
    this.onTickUpdate = onTickUpdate;
};

SCg.LayoutAlgorithm.prototype = {
    constructor: SCg.LayoutAlgorithm
};

// --------------------------

SCg.LayoutAlgorithmForceBased = function(nodes, edges, contours, onTickUpdate, rect) {
    SCg.LayoutAlgorithm.call(this, nodes, edges, contours, onTickUpdate);
    this.rect = rect;
};

SCg.LayoutAlgorithmForceBased.prototype = Object.create( SCg.LayoutAlgorithm );

SCg.LayoutAlgorithmForceBased.prototype.destroy = function() {
    this.stop();
};

SCg.LayoutAlgorithmForceBased.prototype.stop = function() {
      if (this.force) {
        this.force.stop();
        delete this.force;
        this.force = null;
    }
  
};

SCg.LayoutAlgorithmForceBased.prototype.start = function() {
    
    this.stop();
    
    // init D3 force layout
    var self = this;
    

    this.force = d3.layout.force()
    .nodes(this.nodes)
    .links(this.edges)
    .size(this.rect)
    .friction(0.9)
    .gravity(0.03)
    .linkDistance(function(edge){
        
        var p1 = edge.source.object.getConnectionPos(edge.target.object.position, edge.object.source_dot);
        var p2 = edge.target.object.getConnectionPos(edge.source.object.position, edge.object.target_dot);
        var cd = edge.source.object.position.clone().sub(edge.target.object.position).length();
        var d = cd - p1.sub(p2).length();
        
		if (edge.source.type == SCgLayoutObjectType.DotPoint ||
			edge.target.type == SCgLayoutObjectType.DotPoint) {
			return d + 50;
		}

		return 100 + d;
	})
	.linkStrength(function(edge){
		if (edge.source.type == SCgLayoutObjectType.DotPoint ||
			edge.target.type == SCgLayoutObjectType.DotPoint) {
			return 1;
		}

		return 0.3;
	})
    .charge(function(node) {
		if (node.type == SCgLayoutObjectType.DotPoint) {
            return 0;
		} else if (node.type == SCgLayoutObjectType.Link) {
            return -900;
        }
        
		return -700;
	})
    .on('tick', function() {
        self.onLayoutTick();
    })
    .start();
};

SCg.LayoutAlgorithmForceBased.prototype.onLayoutTick = function() {
    
    var dots = [];
    for (idx in this.nodes) {
        var node_layout = this.nodes[idx];
        
        if (node_layout.type === SCgLayoutObjectType.Node ||
            node_layout.type === SCgLayoutObjectType.Link ||
            node_layout.type === SCgLayoutObjectType.Contour ||
            node_layout.type === SCgLayoutObjectType.Custom
           ) {
            node_layout.object.setPosition(new SCg.Vector3(node_layout.x, node_layout.y, 0));
        } else if (node_layout.type === SCgLayoutObjectType.DotPoint) {
            dots.push(node_layout);
        } 
    }
    
    // setup dot points positions 
    for (idx in dots) {
        var dot = dots[idx];
        
        var edge = dot.object.target;
        if (dot.source)
            edge = dot.object.source;
                
        dot.x = edge.position.x;
        dot.y = edge.position.y;
    }
    
    this.onTickUpdate();
};


// ------------------------------------

SCg.LayoutManager = function() {

};

SCg.LayoutManager.prototype = {
    constructor: SCg.LayoutManager
};

SCg.LayoutManager.prototype.init = function(scene) {
    this.scene = scene;
    this.nodes = null;
    this.edges = null;
    
    this.algorithm = null;
};

/**
 * Prepare objects for layout
 */
SCg.LayoutManager.prototype.prepareObjects = function() {

    this.nodes = new Array();
    this.edges = new Array();
    var objDict = {};
    
    var self = this;
    
    function collectNodeObjects(_array, _type) {
        for (idx in _array) {
            var node = _array[idx];
            if (node.contour)
                continue;

            var obj = new Object();

            obj.x = node.position.x;
            obj.y = node.position.y;
            obj.object = node;
            obj.type = _type;

            objDict[node.id] = obj;
            self.nodes.push(obj);
        }
    }
    
    // first of all we need to collect objects from scene, and build them representation for layout
    collectNodeObjects(this.scene.nodes, SCgLayoutObjectType.Node);
    collectNodeObjects(this.scene.links, SCgLayoutObjectType.Link);
    collectNodeObjects(this.scene.customs, SCgLayoutObjectType.Custom);
    
    for (idx in this.scene.edges) {
        var edge = this.scene.edges[idx];
        if (edge.contour)
            continue;
        
        var obj = new Object();
        
        obj.object = edge;
        obj.type = SCgLayoutObjectType.Edge;
        
        objDict[edge.id] = obj;
        this.edges.push(obj);
    }
    
    collectNodeObjects(this.scene.contours, SCgLayoutObjectType.Contour);
    
    // store begin and end for edges
    for (idx in this.edges) {
        edge = this.edges[idx];
        
        source = objDict[edge.object.source.id];
        target = objDict[edge.object.target.id];
        
        function getEdgeObj(srcObj, isSource) {
            if (srcObj.type == SCgLayoutObjectType.Edge) {
                var obj = new Object();
                obj.type = SCgLayoutObjectType.DotPoint;
                obj.object = srcObj.object;
                obj.source = isSource;
            
                return obj;
            }
            return srcObj;
        };
                
        edge.source = getEdgeObj(source, true);
        edge.target = getEdgeObj(target, false);
        
        if (edge.source != source)
            this.nodes.push(edge.source);
        if (edge.target != target)
            this.nodes.push(edge.target);
    }
    
};

/**
 * Starts layout in scene
 */
SCg.LayoutManager.prototype.doLayout = function() {
    
    if (this.algorithm) {
        this.algorithm.stop();
        delete this.algorithm;
    }
    
    this.prepareObjects();
    this.algorithm = new SCg.LayoutAlgorithmForceBased(this.nodes, this.edges, null, 
                                                        $.proxy(this.onTickUpdate, this), 
                                                        this.scene.getContainerSize());
    this.algorithm.start();
};

SCg.LayoutManager.prototype.onTickUpdate = function() { 
    this.scene.updateObjectsVisual();
};
