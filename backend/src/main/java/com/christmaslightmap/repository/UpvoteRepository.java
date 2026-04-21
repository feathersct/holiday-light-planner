package com.christmaslightmap.repository;

import com.christmaslightmap.model.Upvote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface UpvoteRepository extends JpaRepository<Upvote, Long> {
    @Query(value = "SELECT COUNT(*) FROM upvotes WHERE user_id = :userId AND display_id = :displayId", nativeQuery = true)
    long countByUserAndDisplay(@Param("userId") Long userId, @Param("displayId") Long displayId);

    @Transactional
    @Query("DELETE FROM Upvote u WHERE u.user.id = :userId AND u.display.id = :displayId")
    @org.springframework.data.jpa.repository.Modifying
    void deleteByUserIdAndDisplayId(@Param("userId") Long userId, @Param("displayId") Long displayId);

    @Query("SELECT u FROM Upvote u JOIN FETCH u.display d WHERE u.user.id = :userId AND d.isActive = true")
    List<Upvote> findByUserIdWithActiveDisplays(@Param("userId") Long userId);
}
