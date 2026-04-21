package com.christmaslightmap.repository;

import com.christmaslightmap.model.Display;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DisplayRepository extends JpaRepository<Display, Long> {

    @Query(value = """
        SELECT d.id, d.title, d.city, d.state,
               ST_Y(d.location::geometry) AS lat, ST_X(d.location::geometry) AS lng,
               d.upvote_count, d.photo_count, d.display_type, d.created_at,
               (SELECT p.url FROM display_photos p
                WHERE p.display_id = d.id AND p.is_primary = true LIMIT 1) AS primary_photo_url
        FROM displays d
        WHERE d.is_active = true
          AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
          AND (:displayType IS NULL OR d.display_type = :displayType)
        ORDER BY d.upvote_count DESC
        LIMIT :lim OFFSET :off
        """, nativeQuery = true)
    List<Object[]> searchDisplays(
        @Param("lat") double lat,
        @Param("lng") double lng,
        @Param("radiusMetres") double radiusMetres,
        @Param("displayType") String displayType,
        @Param("lim") int limit,
        @Param("off") int offset
    );

    @Query(value = """
        SELECT COUNT(*) FROM displays d
        WHERE d.is_active = true
          AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
          AND (:displayType IS NULL OR d.display_type = :displayType)
        """, nativeQuery = true)
    long countSearchDisplays(
        @Param("lat") double lat,
        @Param("lng") double lng,
        @Param("radiusMetres") double radiusMetres,
        @Param("displayType") String displayType
    );

    @Query(value = """
        SELECT d.id, d.title, d.city, d.state,
               ST_Y(d.location::geometry) AS lat, ST_X(d.location::geometry) AS lng,
               d.upvote_count, d.photo_count, d.display_type, d.created_at,
               (SELECT p.url FROM display_photos p
                WHERE p.display_id = d.id AND p.is_primary = true LIMIT 1) AS primary_photo_url
        FROM displays d
        WHERE d.is_active = true
          AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
          AND (:displayType IS NULL OR d.display_type = :displayType)
          AND EXISTS (SELECT 1 FROM display_tags dt WHERE dt.display_id = d.id AND dt.tag_id IN (:tagIds))
        ORDER BY d.upvote_count DESC
        LIMIT :lim OFFSET :off
        """, nativeQuery = true)
    List<Object[]> searchDisplaysWithTags(
        @Param("lat") double lat,
        @Param("lng") double lng,
        @Param("radiusMetres") double radiusMetres,
        @Param("displayType") String displayType,
        @Param("tagIds") List<Long> tagIds,
        @Param("lim") int limit,
        @Param("off") int offset
    );

    @Query(value = """
        SELECT COUNT(*) FROM displays d
        WHERE d.is_active = true
          AND ST_DWithin(d.location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)
          AND (:displayType IS NULL OR d.display_type = :displayType)
          AND EXISTS (SELECT 1 FROM display_tags dt WHERE dt.display_id = d.id AND dt.tag_id IN (:tagIds))
        """, nativeQuery = true)
    long countSearchDisplaysWithTags(
        @Param("lat") double lat,
        @Param("lng") double lng,
        @Param("radiusMetres") double radiusMetres,
        @Param("displayType") String displayType,
        @Param("tagIds") List<Long> tagIds
    );

    @Query("SELECT d FROM Display d LEFT JOIN FETCH d.tags WHERE d.id IN :ids")
    List<Display> findByIdInWithTags(@Param("ids") List<Long> ids);

    List<Display> findByUserIdAndIsActiveTrue(Long userId);
}
