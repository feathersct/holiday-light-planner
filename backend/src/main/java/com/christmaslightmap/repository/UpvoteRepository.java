package com.christmaslightmap.repository;

import com.christmaslightmap.model.Upvote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface UpvoteRepository extends JpaRepository<Upvote, Long> {
    @Query(value = "SELECT COUNT(*) FROM upvotes WHERE user_id = :userId AND display_id = :listingId", nativeQuery = true)
    long countByUserAndListing(@Param("userId") Long userId, @Param("listingId") Long listingId);

    @Transactional
    @Query("DELETE FROM Upvote u WHERE u.user.id = :userId AND u.listing.id = :listingId")
    @org.springframework.data.jpa.repository.Modifying
    void deleteByUserIdAndListingId(@Param("userId") Long userId, @Param("listingId") Long listingId);

    @Query("SELECT u FROM Upvote u JOIN FETCH u.listing d WHERE u.user.id = :userId AND d.isActive = true")
    List<Upvote> findByUserIdWithActiveListings(@Param("userId") Long userId);
}
