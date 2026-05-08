
const branchFilter = (req, res, next) => {
    // If not logged in, skip (though most routes require login)
    if (!req.user) return next();

    const { role, branchId } = req.user;

    // Super Admin can see anything, but can also filter by branch if provided
    if (role === 'admin') {
        if (req.query.branchId) {
            req.branchQuery = { branchId: req.query.branchId };
        } else {
            // Admin default is to see their own branch, or we can leave it empty to see all
            // The user said "Admin stays the same", likely meaning Super Admin manages all.
            // Let's allow Admin to see everything if no branchId is specified in query.
            req.branchQuery = {}; 
        }
    } else {
        // All other roles are STRICTLY locked to their branch
        req.branchQuery = { branchId: branchId || 'gombita-1' };
        
        // Force branchId in body for POST/PUT requests
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            req.body.branchId = branchId || 'gombita-1';
        }
        
        // Force branchId in query for GET/DELETE requests
        req.query.branchId = branchId || 'gombita-1';
    }

    next();
};

module.exports = branchFilter;
