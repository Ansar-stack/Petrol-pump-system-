import prisma from "../configs/db/db.config.js";

export const PUBLIC_OWNER_INCLUDE = {
    owner: {
        select: {
            id: true,
            profile: true,
            user: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    },
};

export const sanitizeProperty = ({ isDeleted, deletedAt, ...rest }) => rest;
export const sanitizeProperties = (properties) => properties.map(sanitizeProperty);

export const toPositiveInt = (value, fallback = null) => {
    if (value == null) return fallback;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const toBoolean = (value) => {
    if (value == null) return null;
    const normalized = value.toString().trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
    return null;
};

export const buildPublicPropertyWhere = (query = {}) => {
    const province = query.province?.toString().trim();
    const city = query.city?.toString().trim();
    const propertyType = query.propertyType?.toString().trim() || query.property_type?.toString().trim();
    const transactionType = query.transactionType?.toString().trim() || query.transaction_type?.toString().trim();
    const listingStatus = query.listingStatus?.toString().trim().toLowerCase() || query.listing_status?.toString().trim().toLowerCase();
    const minPrice = toPositiveInt(query.minPrice);
    const maxPrice = toPositiveInt(query.maxPrice);
    const minArea = toPositiveInt(query.minArea);
    const maxArea = toPositiveInt(query.maxArea);
    const minBedrooms = toPositiveInt(query.minBedrooms ?? query.bedrooms);
    const minBathrooms = toPositiveInt(query.minBathrooms ?? query.bathrooms);
    const ownerId = toPositiveInt(query.ownerId);
    const featured = toBoolean(query.featured);
    const q = query.q?.toString().trim();
    const amenitiesRaw = query.amenities?.toString().trim();

    const where = {
        status: "verified",
        isDeleted: false,
    };

    const allowedListingStatuses = ["active", "sold", "rented", "leased"];
    if (listingStatus) {
        if (!allowedListingStatuses.includes(listingStatus)) {
            const error = new Error("listingStatus must be one of active, sold, rented, leased");
            error.statusCode = 400;
            throw error;
        }
        where.listingStatus = listingStatus;
    } else {
        where.listingStatus = "active";
    }

    if (province) where.province = { equals: province, mode: "insensitive" };
    if (city) where.city = { equals: city, mode: "insensitive" };
    if (propertyType) where.propertyType = { equals: propertyType, mode: "insensitive" };
    if (transactionType) where.transactionType = { equals: transactionType, mode: "insensitive" };
    if (ownerId) where.ownerId = ownerId;
    if (featured === true) where.isFeatured = true;

    if (minPrice !== null || maxPrice !== null) {
        where.price = {};
        if (minPrice !== null) where.price.gte = minPrice;
        if (maxPrice !== null) where.price.lte = maxPrice;
    }

    if (minArea !== null || maxArea !== null) {
        where.area = {};
        if (minArea !== null) where.area.gte = minArea;
        if (maxArea !== null) where.area.lte = maxArea;
    }

    if (minBedrooms !== null) where.rooms = { gte: minBedrooms };
    if (minBathrooms !== null) where.bathroom = { gte: minBathrooms };

    if (amenitiesRaw) {
        const amenities = amenitiesRaw
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
        if (amenities.length) {
            where.amenities = { hasEvery: amenities };
        }
    }

    if (q) {
        where.OR = [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { province: { contains: q, mode: "insensitive" } },
        ];
    }

    return where;
};

export const buildPropertyOrderBy = (sort) => {
    const normalized = sort?.toString().trim().toLowerCase();

    switch (normalized) {
        case "oldest":
            return { createdAt: "asc" };
        case "price_asc":
            return { price: "asc" };
        case "price_desc":
            return { price: "desc" };
        case "views":
            return { views: "desc" };
        case "favorites":
            return { favorites: { _count: "desc" } };
        case "featured":
            return [{ featuredOrder: "asc" }, { createdAt: "desc" }];
        case "newest":
        default:
            return { createdAt: "desc" };
    }
};

export const fetchPublicProperties = async ({ where, page = 1, pageSize = 10, sort }) => {
    const safePage = Math.max(page, 1);
    const safePageSize = Math.min(Math.max(pageSize, 1), 50);
    const orderBy = buildPropertyOrderBy(sort);

    const queryOptions = {
        where,
        include: {
            images: { where: { status: "verified" } },
            ...PUBLIC_OWNER_INCLUDE,
        },
        orderBy,
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
    };

    if (sort === "favorites") {
        queryOptions.orderBy = undefined;
    }

    const [total, properties] = await Promise.all([
        prisma.property.count({ where }),
        sort === "favorites"
            ? prisma.property.findMany({
                ...queryOptions,
                orderBy: { favorites: { _count: "desc" } },
            })
            : prisma.property.findMany(queryOptions),
    ]);

    return {
        properties: sanitizeProperties(properties),
        pagination: {
            page: safePage,
            pageSize: safePageSize,
            total,
            totalPages: Math.ceil(total / safePageSize) || 1,
        },
    };
};
