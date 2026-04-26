package com.christmaslightmap.repository;

import com.christmaslightmap.model.Listing;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ListingRepository extends JpaRepository<Listing, Long> {

    @Query(value = """
        SELECT d.id, d.title, d.city, d.state,
               ST_Y(d.location::geometry) AS lat, ST_X(d.location::geometry) AS lng,
               d.upvote_count, d.photo_count, d.display_type, d.created_at,
               (SELECT p.url FROM display_photos p
                WHERE p.display_id = d.id AND p.is_primary = true LIMIT 1) AS primary_photo_url,
               d.category, d.start_datetime, d.end_datetime, d.price_info,
               d.cuisine_type, d.organizer, d.website_url,
               h.display_name AS host_name
        FROM listings d
        LEFT JOIN hosts h ON h.id = d.host_id
        WHERE d.is_active = true
          AND d.host_id IS NOT NULL
          AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
          AND (:category IS NULL OR d.category = :category)
          AND (:includeExpired OR d.end_datetime >= NOW())
        ORDER BY d.upvote_count DESC
        LIMIT :lim OFFSET :off
        """, nativeQuery = true)
    List<Object[]> searchListings(
        @Param("lat") double lat,
        @Param("lng") double lng,
        @Param("radiusMetres") double radiusMetres,
        @Param("category") String category,
        @Param("includeExpired") boolean includeExpired,
        @Param("lim") int limit,
        @Param("off") int offset
    );

    @Query(value = """
        SELECT COUNT(*) FROM listings d
        WHERE d.is_active = true
          AND d.host_id IS NOT NULL
          AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
          AND (:category IS NULL OR d.category = :category)
          AND (:includeExpired OR d.end_datetime >= NOW())
        """, nativeQuery = true)
    long countSearchListings(
        @Param("lat") double lat,
        @Param("lng") double lng,
        @Param("radiusMetres") double radiusMetres,
        @Param("category") String category,
        @Param("includeExpired") boolean includeExpired
    );

    @Query(value = """
        SELECT d.id, d.title, d.city, d.state,
               ST_Y(d.location::geometry) AS lat, ST_X(d.location::geometry) AS lng,
               d.upvote_count, d.photo_count, d.display_type, d.created_at,
               (SELECT p.url FROM display_photos p
                WHERE p.display_id = d.id AND p.is_primary = true LIMIT 1) AS primary_photo_url,
               d.category, d.start_datetime, d.end_datetime, d.price_info,
               d.cuisine_type, d.organizer, d.website_url,
               h.display_name AS host_name
        FROM listings d
        LEFT JOIN hosts h ON h.id = d.host_id
        WHERE d.is_active = true
          AND d.host_id IS NOT NULL
          AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
          AND (:category IS NULL OR d.category = :category)
          AND (:includeExpired OR d.end_datetime >= NOW())
          AND EXISTS (SELECT 1 FROM display_tags dt WHERE dt.display_id = d.id AND dt.tag_id IN (:tagIds))
        ORDER BY d.upvote_count DESC
        LIMIT :lim OFFSET :off
        """, nativeQuery = true)
    List<Object[]> searchListingsWithTags(
        @Param("lat") double lat,
        @Param("lng") double lng,
        @Param("radiusMetres") double radiusMetres,
        @Param("category") String category,
        @Param("includeExpired") boolean includeExpired,
        @Param("tagIds") List<Long> tagIds,
        @Param("lim") int limit,
        @Param("off") int offset
    );

    @Query(value = """
        SELECT COUNT(*) FROM listings d
        WHERE d.is_active = true
          AND d.host_id IS NOT NULL
          AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
          AND (:category IS NULL OR d.category = :category)
          AND (:includeExpired OR d.end_datetime >= NOW())
          AND EXISTS (SELECT 1 FROM display_tags dt WHERE dt.display_id = d.id AND dt.tag_id IN (:tagIds))
        """, nativeQuery = true)
    long countSearchListingsWithTags(
        @Param("lat") double lat,
        @Param("lng") double lng,
        @Param("radiusMetres") double radiusMetres,
        @Param("category") String category,
        @Param("includeExpired") boolean includeExpired,
        @Param("tagIds") List<Long> tagIds
    );

    @Query("SELECT d FROM Listing d LEFT JOIN FETCH d.tags WHERE d.id IN :ids")
    List<Listing> findByIdInWithTags(@Param("ids") List<Long> ids);

    @Query("SELECT l FROM Listing l LEFT JOIN FETCH l.tags WHERE l.host.id = :hostId AND l.isActive = true AND l.endDatetime >= :now ORDER BY l.startDatetime ASC")
    List<Listing> findActiveByHostId(@Param("hostId") Long hostId, @Param("now") LocalDateTime now);

    @Query("SELECT l FROM Listing l LEFT JOIN FETCH l.tags WHERE l.host.id = :hostId ORDER BY l.startDatetime DESC")
    List<Listing> findByHostIdOrderByStartDatetimeDesc(@Param("hostId") Long hostId);

    Page<Listing> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Listing> findByIsActiveOrderByCreatedAtDesc(boolean isActive, Pageable pageable);

    boolean existsByHostIdAndIsActiveTrue(Long hostId);

    int countByHostIdAndIsActiveTrue(Long hostId);
}
